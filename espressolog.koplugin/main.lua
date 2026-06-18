--[[
Espresso log — read-only KOReader-plugin

Toont een dashboard van je espresso-shots uit Supabase, fullscreen in een
TextViewer: samenvattende meters (zoals de web-app) + de laatste shots.
Praat rechtstreeks met de Supabase REST API (PostgREST) via de anon key —
NIET via de supabase-js client.

Ververst:
  * vers bij openen (instant uit cache, daarna live bijgewerkt)
  * automatisch elk uur via wifi (CONFIG.refresh_minutes)

Geregistreerd als:
  * menu-item onder "More tools"
  * Dispatcher-actie "ShowEspressoLog" (koppelbaar aan een gesture)
--]]

-- ============================================================================
-- CONFIG — Supabase project
-- ----------------------------------------------------------------------------
-- De anon key is veilig om in een client te zetten: row-level security beperkt
-- 'anon' tot read-only op de shots-tabel (policy "anon read shots").
-- ============================================================================
local CONFIG = {
    base_url        = "https://wkbjugwavyebiurhuspa.supabase.co",
    anon_key        = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrYmp1Z3dhdnllYml1cmh1c3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzUyMzIsImV4cCI6MjA5MjkxMTIzMn0.w3K_QN2O3zqNFJa1-IfuA11zRxTYHFOFAmUkDxs8vsA",
    table           = "shots",
    list_limit      = 12,    -- aantal shots in de detaillijst
    fetch_limit     = 1000,  -- max rijen voor de stats-berekening
    refresh_minutes = 60,    -- automatische verversing via wifi (0 = uit)
}
-- ============================================================================

local Dispatcher      = require("dispatcher")
local InfoMessage     = require("ui/widget/infomessage")
local NetworkMgr      = require("ui/network/manager")
local TextViewer      = require("ui/widget/textviewer")
local UIManager       = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local logger          = require("logger")
local socket          = require("socket")
local socketutil      = require("socketutil")
local https           = require("ssl.https")
local ltn12           = require("ltn12")
local rapidjson       = require("rapidjson")
local _               = require("gettext")

local SEP = string.rep("─", 34)

local EspressoLog = WidgetContainer:extend{
    name = "espressolog",
    is_doc_only = false,
}

-- Module-level state: er is altijd maar één actieve KOReader-UI, dus we delen
-- de cache + viewer + timer zodat herstarten van de plugin geen dubbele
-- timers of weesvensters oplevert.
local cached_text = nil
local viewer      = nil
local auto_task   = nil

-- ---------------------------------------------------------------------------
-- Helpers (formattering)
-- ---------------------------------------------------------------------------

-- 18.00 -> "18", 5.5 -> "5.5" (geen overbodige .0)
local function num(n)
    n = tonumber(n)
    if not n then return "?" end
    if n == math.floor(n) then
        return string.format("%d", n)
    end
    return string.format("%.1f", n)
end

-- "2026-06-18T08:30:00+00:00" -> "18-06-2026 08:30" (UTC zoals opgeslagen)
local function fmtDate(iso)
    if type(iso) ~= "string" then return "?" end
    local y, mo, d, h, mi = iso:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+)")
    if not y then return iso end
    return string.format("%s-%s-%s %s:%s", d, mo, y, h, mi)
end

-- 4.5 -> "★★★★½☆"
local function starGlyphs(r)
    r = tonumber(r) or 0
    local full = math.floor(r + 0.001)
    local half = (r - full) >= 0.5
    local empty = 5 - full - (half and 1 or 0)
    if empty < 0 then empty = 0 end
    return string.rep("★", full) .. (half and "½" or "") .. string.rep("☆", empty)
end

-- Tekst-meter: 0.62, 12 -> "███████░░░░░"
local function bar(frac, width)
    width = width or 12
    frac = tonumber(frac) or 0
    if frac ~= frac or frac < 0 then frac = 0 end  -- NaN / negatief
    if frac > 1 then frac = 1 end
    local filled = math.floor(frac * width + 0.5)
    return string.rep("█", filled) .. string.rep("░", width - filled)
end

local function avg(t)
    if #t == 0 then return nil end
    local sum = 0
    for _, v in ipairs(t) do sum = sum + v end
    return sum / #t
end

-- ---------------------------------------------------------------------------
-- Stats + rapport
-- ---------------------------------------------------------------------------

local function computeStats(shots)
    local dialin = 0
    local beans_seen, bean_count = {}, 0
    local r_vals, ratio_vals, time_vals = {}, {}, {}
    local hist = { 0, 0, 0, 0, 0 }  -- 1..5 sterren (effectieve shots)

    for _, s in ipairs(shots) do
        if s.dial_in then dialin = dialin + 1 end

        local bn = (type(s.beans) == "table" and s.beans.name) or nil
        if bn and not beans_seen[bn] then
            beans_seen[bn] = true
            bean_count = bean_count + 1
        end

        -- Dial-in shots tellen niet mee in de gemiddelden (zoals de web-app).
        if not s.dial_in then
            local r = tonumber(s.rating)
            if r then
                table.insert(r_vals, r)
                local b = math.floor(r + 0.5)
                if b < 1 then b = 1 elseif b > 5 then b = 5 end
                hist[b] = hist[b] + 1
            end
            local rt = tonumber(s.brew_ratio)
            if rt then table.insert(ratio_vals, rt) end
            local tm = tonumber(s.extraction_time_seconds)
            if tm then table.insert(time_vals, tm) end
        end
    end

    return {
        total      = #shots,
        dialin     = dialin,
        beans      = bean_count,
        effective  = #r_vals,
        avg_rating = avg(r_vals),
        avg_ratio  = avg(ratio_vals),
        avg_time   = avg(time_vals),
        hist       = hist,
    }
end

local function formatShot(s)
    local bean = _("Onbekende boon")
    if type(s.beans) == "table" and s.beans.name then
        bean = s.beans.name
        if s.beans.roaster and s.beans.roaster ~= "" then
            bean = bean .. " — " .. s.beans.roaster
        end
    end

    local dose  = tonumber(s.dose_grams) or 0
    local yield = tonumber(s.yield_grams) or 0
    local ratio = tonumber(s.brew_ratio)
    local ratio_str = ratio and string.format("1:%.1f", ratio) or "?"
    local time  = tonumber(s.extraction_time_seconds) or 0

    local header = fmtDate(s.created_at)
    if s.dial_in then header = header .. "   [dial-in]" end

    local lines = {
        header,
        "  " .. bean,
        string.format("  %sg → %sg   (%s)", num(dose), num(yield), ratio_str),
        string.format("  ⏱ %ds    ⚙ maalstand %s", time, num(s.grind_size)),
        string.format("  %s  %s", starGlyphs(s.rating), num(s.rating)),
    }
    return table.concat(lines, "\n")
end

-- Bouwt het volledige dashboard (meters + laatste shots) uit alle rijen.
local function buildReport(shots)
    local st = computeStats(shots)
    local L = {}

    table.insert(L, "☕  ESPRESSO LOG")
    table.insert(L, "Bijgewerkt: " .. os.date("%d-%m-%Y %H:%M"))
    table.insert(L, SEP)

    -- Kerncijfers (zoals de drie tegels op het web-dashboard).
    local dial = st.dialin > 0 and string.format("  (%d dial-in)", st.dialin) or ""
    table.insert(L, string.format("Shots: %d%s     Bonen: %d", st.total, dial, st.beans))
    table.insert(L, "")

    -- Meters.
    if st.avg_rating then
        table.insert(L, string.format("Gem. rating  %s  %.1f/5",
            bar(st.avg_rating / 5), st.avg_rating))
    end
    if st.avg_ratio then
        -- schaal 1:1.5 (ristretto) .. 1:3.0 (lungo)
        table.insert(L, string.format("Gem. ratio   %s  1:%.1f",
            bar((st.avg_ratio - 1.5) / 1.5), st.avg_ratio))
    end
    if st.avg_time then
        -- schaal 20s .. 35s
        table.insert(L, string.format("Gem. tijd    %s  %ds",
            bar((st.avg_time - 20) / 15), math.floor(st.avg_time + 0.5)))
    end

    -- Rating-verdeling (histogram, alleen effectieve shots).
    if st.effective > 0 then
        table.insert(L, "")
        table.insert(L, "Verdeling rating")
        local maxc = 1
        for i = 1, 5 do if st.hist[i] > maxc then maxc = st.hist[i] end end
        for i = 5, 1, -1 do
            table.insert(L, string.format("%d★ %s %d",
                i, bar(st.hist[i] / maxc, 10), st.hist[i]))
        end
    end

    table.insert(L, SEP)
    table.insert(L, string.format("LAATSTE %d SHOTS",
        math.min(CONFIG.list_limit, st.total)))
    table.insert(L, "")

    local n = 0
    for _, s in ipairs(shots) do
        n = n + 1
        if n > CONFIG.list_limit then break end
        table.insert(L, formatShot(s))
        table.insert(L, "")
    end

    return table.concat(L, "\n")
end

-- ---------------------------------------------------------------------------
-- Netwerk (PostgREST)
-- ---------------------------------------------------------------------------

local function buildUrl()
    -- beans(...) embed haalt de boon-naam mee via de foreign key shots.bean_id.
    local sel = "created_at,dose_grams,yield_grams,brew_ratio,grind_size,"
        .. "extraction_time_seconds,rating,dial_in,beans(name,roaster)"
    return string.format(
        "%s/rest/v1/%s?select=%s&order=created_at.desc&limit=%d",
        CONFIG.base_url, CONFIG.table, sel, CONFIG.fetch_limit)
end

-- Voert de GET uit met ssl.https. Geeft (body) of (nil, foutmelding) terug.
local function httpGet(url)
    local sink = {}
    socketutil:set_timeout(10, 30)
    local code, _headers, status = socket.skip(1, https.request{
        url = url,
        method = "GET",
        headers = {
            ["apikey"]        = CONFIG.anon_key,
            ["Authorization"] = "Bearer " .. CONFIG.anon_key,
            ["Accept"]        = "application/json",
        },
        sink = ltn12.sink.table(sink),
    })
    socketutil:reset_timeout()

    if type(code) ~= "number" then
        return nil, _("Geen verbinding: ") .. tostring(status or code)
    end
    local body = table.concat(sink)
    if code < 200 or code >= 300 then
        return nil, string.format("HTTP %d\n%s", code, body)
    end
    return body
end

-- ---------------------------------------------------------------------------
-- Viewer + ophalen
-- ---------------------------------------------------------------------------

local function openViewer(text)
    -- Bestaande viewer vervangen = in-place ververs.
    if viewer then
        UIManager:close(viewer)
        viewer = nil
    end
    viewer = TextViewer:new{
        title = _("Espresso log"),
        text = text,
        justified = false,
        close_callback = function() viewer = nil end,
    }
    UIManager:show(viewer)
end

-- opts.show   = open de viewer ook als hij nog dicht is (handmatig openen)
-- opts.silent = geen foutmeldingen tonen (achtergrond-ververs)
local function doRefresh(opts)
    opts = opts or {}
    local body, err = httpGet(buildUrl())
    if not body then
        logger.warn("espressolog: fetch mislukt:", err)
        if not opts.silent then
            UIManager:show(InfoMessage:new{
                text = _("Kon de espresso-log niet ophalen:\n") .. err,
            })
        end
        return
    end

    local data = rapidjson.decode(body)
    if type(data) ~= "table" or #data == 0 then
        if not opts.silent then
            UIManager:show(InfoMessage:new{
                text = _("Geen shots gevonden of onverwacht antwoord."),
            })
        end
        return
    end

    cached_text = buildReport(data)
    -- Toon bij handmatig openen, of ververs een reeds geopende viewer.
    if opts.show or viewer then
        openViewer(cached_text)
    end
end

-- ---------------------------------------------------------------------------
-- Automatische verversing (elk uur via wifi)
-- ---------------------------------------------------------------------------

local function setupAutoRefresh()
    if auto_task then
        UIManager:unschedule(auto_task)
        auto_task = nil
    end
    local minutes = CONFIG.refresh_minutes or 0
    if minutes <= 0 then return end
    local interval = minutes * 60
    auto_task = function()
        NetworkMgr:runWhenOnline(function()
            doRefresh({ silent = true })
        end)
        UIManager:scheduleIn(interval, auto_task)
    end
    UIManager:scheduleIn(interval, auto_task)
end

-- ---------------------------------------------------------------------------
-- Openen
-- ---------------------------------------------------------------------------

function EspressoLog:showLog()
    -- Instant uit cache (snappy op e-ink), daarna vers ophalen.
    if cached_text then
        openViewer(cached_text)
    end
    NetworkMgr:runWhenOnline(function()
        doRefresh({ show = true })
    end)
end

-- ---------------------------------------------------------------------------
-- Registratie: Dispatcher-actie + menu
-- ---------------------------------------------------------------------------

function EspressoLog:onDispatcherRegisterActions()
    Dispatcher:registerAction("show_espresso_log", {
        category = "none",
        event    = "ShowEspressoLog",
        title    = _("Espresso log"),
        general  = true,
    })
end

function EspressoLog:init()
    self:onDispatcherRegisterActions()
    self.ui.menu:registerToMainMenu(self)
    setupAutoRefresh()
end

function EspressoLog:addToMainMenu(menu_items)
    menu_items.espressolog = {
        text = _("Espresso log"),
        sorting_hint = "more_tools",
        callback = function()
            self:showLog()
        end,
    }
end

-- Gesture / Dispatcher -> refresh-on-tap (haalt elke keer vers op).
function EspressoLog:onShowEspressoLog()
    self:showLog()
    return true
end

return EspressoLog
