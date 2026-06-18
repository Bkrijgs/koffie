--[[
Espresso log — read-only KOReader-plugin

Fullscreen dashboard van je espresso-shots uit Supabase: meters, grafiekjes
en een compacte 2-koloms shotlijst. Praat rechtstreeks met de Supabase REST
API (PostgREST) via de anon key — NIET via de supabase-js client.

Ververst:
  * vers bij openen (instant uit cache, daarna live bijgewerkt)
  * automatisch elk uur via wifi (CONFIG.refresh_minutes)

Geregistreerd als:
  * menu-item onder "More tools"
  * Dispatcher-actie "ShowEspressoLog" (koppelbaar aan een gesture)
--]]

-- ============================================================================
-- CONFIG — Supabase project + weergave
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
    font_size       = 16,    -- viewer-lettergrootte (kleiner = meer per regel)
    col_width       = 23,    -- breedte (tekens) per kolom in de shotlijst
    spark_len       = 16,    -- aantal punten in de trend-sparkline
}
-- ============================================================================

local Dispatcher      = require("dispatcher")
local Device          = require("device")
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

local Screen = Device.screen
local SEP = string.rep("─", 40)
local SPARK = { "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█" }

local EspressoLog = WidgetContainer:extend{
    name = "espressolog",
    is_doc_only = false,
}

-- Module-level state: er is altijd maar één actieve KOReader-UI.
local cached_text = nil
local viewer      = nil
local auto_task   = nil

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

local function num(n)
    n = tonumber(n)
    if not n then return "?" end
    if n == math.floor(n) then return string.format("%d", n) end
    return string.format("%.1f", n)
end

-- "2026-06-18T08:30:00+00:00" -> "18-06 08:30"
local function fmtShort(iso)
    if type(iso) ~= "string" then return "?" end
    local _y, mo, d, h, mi = iso:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+)")
    if not d then return iso end
    return string.format("%s-%s %s:%s", d, mo, h, mi)
end

-- "2026-06-18T..." -> "18-06"
local function fmtDay(iso)
    if type(iso) ~= "string" then return "?" end
    local _y, mo, d = iso:match("(%d+)-(%d+)-(%d+)")
    if not d then return "?" end
    return string.format("%s-%s", d, mo)
end

-- YYYY-MM-DD (UTC, zoals opgeslagen)
local function dayKey(iso)
    return type(iso) == "string" and iso:sub(1, 10) or nil
end

-- Splits een UTF-8 string in losse tekens (voor breedte-correcte padding).
local function utf8chars(s)
    local t = {}
    for c in (s or ""):gmatch("[\1-\127\194-\244][\128-\191]*") do
        t[#t + 1] = c
    end
    return t
end

-- Pad of kap een string op exact w tekens (ASCII-spaties als opvulling).
local function padTrunc(s, w)
    local chars = utf8chars(s)
    if #chars > w then
        local out = {}
        for i = 1, w - 1 do out[i] = chars[i] end
        return table.concat(out) .. "…"
    end
    return s .. string.rep(" ", w - #chars)
end

local function bar(frac, width)
    width = width or 12
    frac = tonumber(frac) or 0
    if frac ~= frac or frac < 0 then frac = 0 end
    if frac > 1 then frac = 1 end
    local filled = math.floor(frac * width + 0.5)
    return string.rep("█", filled) .. string.rep("░", width - filled)
end

local function starGlyphs(r)
    r = tonumber(r) or 0
    local full = math.floor(r + 0.001)
    local half = (r - full) >= 0.5
    local empty = 5 - full - (half and 1 or 0)
    if empty < 0 then empty = 0 end
    return string.rep("★", full) .. (half and "½" or "") .. string.rep("☆", empty)
end

local function avg(t)
    if #t == 0 then return nil end
    local sum = 0
    for _, v in ipairs(t) do sum = sum + v end
    return sum / #t
end

-- Sparkline uit een chronologische reeks ratings (0.5..5).
local function sparkline(vals, maxlen)
    local n = #vals
    if n == 0 then return "" end
    local start = math.max(1, n - maxlen + 1)
    local out = {}
    for i = start, n do
        local idx = math.floor((vals[i] - 0.5) / 4.5 * 7 + 0.5) + 1
        if idx < 1 then idx = 1 elseif idx > 8 then idx = 8 end
        out[#out + 1] = SPARK[idx]
    end
    return table.concat(out)
end

-- ---------------------------------------------------------------------------
-- Stats
-- ---------------------------------------------------------------------------

local function computeStats(shots)
    local dialin = 0
    local beans_seen, bean_count = {}, 0
    local bean_counts = {}
    local r_vals, ratio_vals, time_vals = {}, {}, {}
    local ratings_desc = {}
    local hist = { 0, 0, 0, 0, 0 }
    local best = nil

    for _, s in ipairs(shots) do
        if s.dial_in then dialin = dialin + 1 end

        local bn = (type(s.beans) == "table" and s.beans.name) or nil
        if bn then
            if not beans_seen[bn] then
                beans_seen[bn] = true
                bean_count = bean_count + 1
            end
            bean_counts[bn] = (bean_counts[bn] or 0) + 1
        end

        -- Dial-in shots tellen niet mee in de gemiddelden (zoals de web-app).
        if not s.dial_in then
            local r = tonumber(s.rating)
            if r then
                table.insert(r_vals, r)
                table.insert(ratings_desc, r)
                local b = math.floor(r + 0.5)
                if b < 1 then b = 1 elseif b > 5 then b = 5 end
                hist[b] = hist[b] + 1
                if not best or r > best.rating then
                    best = { rating = r, day = fmtDay(s.created_at), bean = bn or "?" }
                end
            end
            local rt = tonumber(s.brew_ratio)
            if rt then table.insert(ratio_vals, rt) end
            local tm = tonumber(s.extraction_time_seconds)
            if tm then table.insert(time_vals, tm) end
        end
    end

    local top_name, top_n = nil, 0
    for name, c in pairs(bean_counts) do
        if c > top_n then top_n = c; top_name = name end
    end

    -- Ratings chronologisch (data komt nieuwste-eerst binnen).
    local ratings_chrono = {}
    for i = #ratings_desc, 1, -1 do
        ratings_chrono[#ratings_chrono + 1] = ratings_desc[i]
    end

    return {
        total = #shots, dialin = dialin, beans = bean_count, effective = #r_vals,
        avg_rating = avg(r_vals), avg_ratio = avg(ratio_vals), avg_time = avg(time_vals),
        hist = hist, ratings_chrono = ratings_chrono, best = best,
        top_bean = top_name and { name = top_name, count = top_n } or nil,
    }
end

-- Telt shots per dag over de afgelopen 7 dagen (device-tijd).
local function weekActivity(shots)
    local now = os.time()
    local days, counts = {}, {}
    for i = 6, 0, -1 do
        local t = now - i * 86400
        local k = os.date("%Y-%m-%d", t)
        days[#days + 1] = { key = k, label = os.date("%a", t) }
        counts[k] = 0
    end
    local week, maxc = 0, 0
    for _, s in ipairs(shots) do
        local k = dayKey(s.created_at)
        if k and counts[k] ~= nil then
            counts[k] = counts[k] + 1
            week = week + 1
            if counts[k] > maxc then maxc = counts[k] end
        end
    end
    local today = counts[days[#days].key]
    return { days = days, counts = counts, week = week, today = today, max = maxc }
end

-- ---------------------------------------------------------------------------
-- Compacte 2-koloms shotkaart
-- ---------------------------------------------------------------------------

-- 3 regels, elk gepadt op CONFIG.col_width tekens.
local function compactCard(s)
    local W = CONFIG.col_width
    local r = tonumber(s.rating)
    local rstr = r and string.format("%.1f*", r) or "-"
    local dial = s.dial_in and " d" or ""
    local dose = num(s.dose_grams)
    local yield = num(s.yield_grams)
    local ratio = tonumber(s.brew_ratio)
    local rt = ratio and string.format("1:%.1f", ratio) or "?"
    local tm = tonumber(s.extraction_time_seconds) or 0
    local grind = num(s.grind_size)
    local bean = (type(s.beans) == "table" and s.beans.name) or "?"

    return {
        padTrunc(string.format("%s   %s%s", fmtShort(s.created_at), rstr, dial), W),
        padTrunc(bean, W),
        padTrunc(string.format("%s->%s %s %ds m%s", dose, yield, rt, tm, grind), W),
    }
end

-- ---------------------------------------------------------------------------
-- Rapport
-- ---------------------------------------------------------------------------

local function buildReport(shots)
    local st = computeStats(shots)
    local act = weekActivity(shots)
    local L = {}
    local function add(line) L[#L + 1] = line end

    add("☕  ESPRESSO LOG")
    add("Bijgewerkt: " .. os.date("%d-%m-%Y %H:%M"))
    add(SEP)

    -- Kerncijfers.
    local dial = st.dialin > 0 and string.format(" (%d dial-in)", st.dialin) or ""
    add(string.format("Shots: %d%s    Bonen: %d", st.total, dial, st.beans))
    add(string.format("Vandaag: %d    Deze week: %d", act.today, act.week))
    add("")

    -- Meters.
    if st.avg_rating then
        add(string.format("Gem. rating  %s  %.1f/5", bar(st.avg_rating / 5), st.avg_rating))
    end
    if st.avg_ratio then
        add(string.format("Gem. ratio   %s  1:%.1f", bar((st.avg_ratio - 1.5) / 1.5), st.avg_ratio))
    end
    if st.avg_time then
        add(string.format("Gem. tijd    %s  %ds", bar((st.avg_time - 20) / 15), math.floor(st.avg_time + 0.5)))
    end

    -- Trend-sparkline.
    if #st.ratings_chrono > 1 then
        add("")
        add("Trend rating  " .. sparkline(st.ratings_chrono, CONFIG.spark_len))
    end

    -- Hoogtepunten.
    if st.best then
        add("")
        add(string.format("Beste:   %.1f★  %s  %s", st.best.rating, st.best.day, st.best.bean))
    end
    if st.top_bean then
        add(string.format("Topboon: %s (%dx)", st.top_bean.name, st.top_bean.count))
    end

    -- Rating-verdeling.
    if st.effective > 0 then
        add("")
        add("Verdeling rating")
        local maxc = 1
        for i = 1, 5 do if st.hist[i] > maxc then maxc = st.hist[i] end end
        for i = 5, 1, -1 do
            add(string.format("%d★ %s %d", i, bar(st.hist[i] / maxc, 10), st.hist[i]))
        end
    end

    -- 7-daagse activiteit.
    add("")
    add("Activiteit (7 dgn)")
    local amax = math.max(act.max, 1)
    for _, day in ipairs(act.days) do
        local c = act.counts[day.key]
        add(string.format("%-3s %s %d", day.label, bar(c / amax, 10), c))
    end

    -- Shotlijst (compact, 2 kolommen).
    add(SEP)
    local shown = math.min(CONFIG.list_limit, st.total)
    add(string.format("LAATSTE %d SHOTS", shown))
    add("")

    local cards = {}
    for i = 1, shown do cards[i] = compactCard(shots[i]) end
    for i = 1, #cards, 2 do
        local left, right = cards[i], cards[i + 1]
        for line = 1, 3 do
            add(left[line] .. "  " .. (right and right[line] or ""))
        end
        add("")
    end

    return table.concat(L, "\n")
end

-- ---------------------------------------------------------------------------
-- Netwerk (PostgREST)
-- ---------------------------------------------------------------------------

local function buildUrl()
    local sel = "created_at,dose_grams,yield_grams,brew_ratio,grind_size,"
        .. "extraction_time_seconds,rating,dial_in,beans(name,roaster)"
    return string.format(
        "%s/rest/v1/%s?select=%s&order=created_at.desc&limit=%d",
        CONFIG.base_url, CONFIG.table, sel, CONFIG.fetch_limit)
end

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
    if viewer then
        UIManager:close(viewer)
        viewer = nil
    end
    viewer = TextViewer:new{
        title = _("Espresso log"),
        text = text,
        monospace_font = true,         -- nodig voor uitgelijnde meters + kolommen
        text_font_size = CONFIG.font_size,
        justified = false,
        width = Screen:getWidth(),     -- fullscreen i.p.v. dialoog-inset
        height = Screen:getHeight(),
        close_callback = function() viewer = nil end,
    }
    UIManager:show(viewer)
end

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

function EspressoLog:onShowEspressoLog()
    self:showLog()
    return true
end

return EspressoLog
