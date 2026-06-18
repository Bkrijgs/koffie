--[[
Espresso log — read-only KOReader-plugin

Toont je laatste espresso dial-in shots uit Supabase, fullscreen in een
TextViewer. Praat rechtstreeks met de Supabase REST API (PostgREST) via de
anon key — NIET via de supabase-js client. Vers ophalen bij openen, geen
auto-poll.

Geregistreerd als:
  * menu-item onder "More tools"
  * Dispatcher-actie "ShowEspressoLog" (koppelbaar aan een gesture)
--]]

-- ============================================================================
-- CONFIG — Supabase project
-- ----------------------------------------------------------------------------
-- Vul hier je eigen project-URL en anon (public) key in. De anon key is veilig
-- om in een client te zetten: row-level security beperkt 'anon' tot read-only
-- op de shots-tabel (policy "anon read shots" => SELECT using (true)).
-- ============================================================================
local CONFIG = {
    base_url = "https://wkbjugwavyebiurhuspa.supabase.co",
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrYmp1Z3dhdnllYml1cmh1c3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzUyMzIsImV4cCI6MjA5MjkxMTIzMn0.w3K_QN2O3zqNFJa1-IfuA11zRxTYHFOFAmUkDxs8vsA",
    table    = "shots",
    limit    = 12,
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

local EspressoLog = WidgetContainer:extend{
    name = "espressolog",
    is_doc_only = false,
}

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

-- 4.5 -> "★★★★½☆  4.5"
local function stars(r)
    r = tonumber(r) or 0
    local full = math.floor(r + 0.001)
    local half = (r - full) >= 0.5
    local empty = 5 - full - (half and 1 or 0)
    if empty < 0 then empty = 0 end
    local s = string.rep("★", full) .. (half and "½" or "") .. string.rep("☆", empty)
    return string.format("%s  %.1f", s, r)
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
        "  " .. stars(s.rating),
    }
    return table.concat(lines, "\n")
end

-- ---------------------------------------------------------------------------
-- Netwerk (PostgREST)
-- ---------------------------------------------------------------------------

local function buildUrl()
    -- beans(...) embed haalt de boon-naam mee via de foreign key shots.bean_id.
    local select = "created_at,dose_grams,yield_grams,brew_ratio,grind_size,"
        .. "extraction_time_seconds,rating,dial_in,beans(name,roaster)"
    return string.format(
        "%s/rest/v1/%s?select=%s&order=created_at.desc&limit=%d",
        CONFIG.base_url, CONFIG.table, select, CONFIG.limit)
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
-- Ophalen + tonen
-- ---------------------------------------------------------------------------

function EspressoLog:fetchAndShow()
    local body, err = httpGet(buildUrl())
    if not body then
        logger.warn("espressolog: fetch mislukt:", err)
        UIManager:show(InfoMessage:new{
            text = _("Kon de espresso-log niet ophalen:\n") .. err,
        })
        return
    end

    local data = rapidjson.decode(body)
    if type(data) ~= "table" then
        UIManager:show(InfoMessage:new{
            text = _("Onverwacht antwoord van de server."),
        })
        return
    end

    if #data == 0 then
        UIManager:show(InfoMessage:new{ text = _("Nog geen shots gevonden.") })
        return
    end

    local blocks = {}
    for _i, shot in ipairs(data) do
        table.insert(blocks, formatShot(shot))
    end
    local text = table.concat(blocks, "\n\n")

    UIManager:show(TextViewer:new{
        title = string.format(_("Espresso log — laatste %d shots"), #data),
        text = text,
        justified = false,
    })
end

-- Wifi aanzetten (indien nodig) en daarna pas ophalen.
function EspressoLog:showLog()
    NetworkMgr:runWhenOnline(function()
        self:fetchAndShow()
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
