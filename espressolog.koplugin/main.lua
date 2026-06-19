--[[
Espresso log — read-only KOReader-plugin

Fullscreen maand-dashboard van je espresso-shots uit Supabase: meters,
grafiekjes en een compacte 2-koloms shotlijst met omlijnde shots. Praat
rechtstreeks met de Supabase REST API (PostgREST) via de anon key — NIET via
de supabase-js client.

Ververst:
  * vers bij elke keer openen (instant uit cache, daarna live bijgewerkt)
  * automatisch elk uur via wifi (CONFIG.refresh_minutes)

Maandnavigatie via de knoppen onderaan de viewer (‹ Maand / Nu / Maand ›).

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
    list_limit      = 12,    -- max shots in de detaillijst (per maand)
    fetch_limit     = 2000,  -- max rijen die we ophalen (genoeg historie)
    refresh_minutes = 60,    -- automatische verversing via wifi (0 = uit)
    font_size       = 16,    -- viewer-lettergrootte (kleiner = meer per regel)
    width_margin    = 0.95,  -- deel van schermbreedte dat we vullen (veiligheid)
}
-- ============================================================================

local Dispatcher      = require("dispatcher")
local Device          = require("device")
local Font            = require("ui/font")
local InfoMessage     = require("ui/widget/infomessage")
local NetworkMgr      = require("ui/network/manager")
local RenderText      = require("ui/rendertext")
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
local SPARK = { "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█" }
local MONTHS = {
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
}

local EspressoLog = WidgetContainer:extend{
    name = "espressolog",
    is_doc_only = false,
}

-- Module-level state (er is altijd maar één actieve KOReader-UI).
local cached_shots = nil   -- ruwe rijen van de laatste fetch
local cached_text  = nil
local viewer       = nil
local auto_task    = nil
local month_offset = 0      -- 0 = huidige maand, 1 = vorige, ...

-- Forward declarations (onderlinge afhankelijkheid viewer <-> render).
local openViewer, renderCurrent

-- ---------------------------------------------------------------------------
-- Kleine helpers
-- ---------------------------------------------------------------------------

local function num(n)
    n = tonumber(n)
    if not n then return "?" end
    if n == math.floor(n) then return string.format("%d", n) end
    return string.format("%.1f", n)
end

local function fmtShort(iso)  -- -> "18-06 08:30"
    if type(iso) ~= "string" then return "?" end
    local _y, mo, d, h, mi = iso:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+)")
    if not d then return iso end
    return string.format("%s-%s %s:%s", d, mo, h, mi)
end

local function fmtDay(iso)  -- -> "18-06"
    if type(iso) ~= "string" then return "?" end
    local _y, mo, d = iso:match("(%d+)-(%d+)-(%d+)")
    if not d then return "?" end
    return string.format("%s-%s", d, mo)
end

local function dayKey(iso)  -- "YYYY-MM-DD" (UTC, zoals opgeslagen)
    return type(iso) == "string" and iso:sub(1, 10) or nil
end

local function utf8chars(s)
    local t = {}
    for c in (s or ""):gmatch("[\1-\127\194-\244][\128-\191]*") do
        t[#t + 1] = c
    end
    return t
end

local function charlen(s) return #utf8chars(s) end

-- Pad of kap een string op exact w tekens.
local function padTrunc(s, w)
    local chars = utf8chars(s)
    if #chars > w then
        local out = {}
        for i = 1, w - 1 do out[i] = chars[i] end
        return table.concat(out) .. "…"
    end
    return s .. string.rep(" ", w - #chars)
end

local function center(s, w)
    local n = charlen(s)
    if n >= w then return s end
    return string.rep(" ", math.floor((w - n) / 2)) .. s
end

local function bar(frac, width)
    width = width or 12
    frac = tonumber(frac) or 0
    if frac ~= frac or frac < 0 then frac = 0 end
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

-- Hoeveel monospace-tekens passen er (met veiligheidsmarge) op een regel?
local function computeCols()
    local ok, char_px = pcall(function()
        local face = Font:getFace("infont", CONFIG.font_size)
        local sz = RenderText:sizeUtf8Text(0, Screen:getWidth() * 4, face, "0000000000", true)
        return sz.x / 10
    end)
    if not ok or not char_px or char_px <= 0 then return 44 end
    local cols = math.floor(Screen:getWidth() * CONFIG.width_margin / char_px)
    if cols < 32 then cols = 32 elseif cols > 96 then cols = 96 end
    return cols
end

-- ---------------------------------------------------------------------------
-- Maand-selectie
-- ---------------------------------------------------------------------------

local function targetMonth(offset)
    local t = os.date("*t")
    local y, m = t.year, t.month - offset
    while m < 1 do m = m + 12; y = y - 1 end
    while m > 12 do m = m - 12; y = y + 1 end
    return y, m
end

local function inMonth(iso, y, m)
    local yy, mm = (iso or ""):match("(%d+)-(%d+)")
    return tonumber(yy) == y and tonumber(mm) == m
end

-- ---------------------------------------------------------------------------
-- Statistiek
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

        if not s.dial_in then  -- dial-in telt niet mee in gemiddelden
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

    local ratings_chrono = {}  -- data komt nieuwste-eerst binnen
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

-- Shots per week-van-de-maand (1..5).
local function monthWeeks(shots)
    local counts = { 0, 0, 0, 0, 0 }
    local maxc = 0
    for _, s in ipairs(shots) do
        local d = tonumber((s.created_at or ""):match("%d+%-%d+%-(%d+)"))
        if d then
            local wk = math.ceil(d / 7)
            if wk < 1 then wk = 1 elseif wk > 5 then wk = 5 end
            counts[wk] = counts[wk] + 1
            if counts[wk] > maxc then maxc = counts[wk] end
        end
    end
    return { counts = counts, max = maxc }
end

-- ---------------------------------------------------------------------------
-- Tekenen: meter, box, kaart
-- ---------------------------------------------------------------------------

-- Label + waarde links, balk vult de rest tot de rand (tail clipt onschadelijk).
local function meterLine(cols, label, frac, value)
    local lead = string.format("%-7s%-6s ", label, value)
    local bw = math.max(4, cols - charlen(lead))
    return lead .. bar(frac, bw)
end

-- Links + rechts uitgevuld op een regel van cols breed.
local function spread(left, right, cols)
    local pad = cols - charlen(left) - charlen(right)
    if pad < 1 then pad = 1 end
    return left .. string.rep(" ", pad) .. right
end

-- Een shot als 3 (ongepadde) regels voor de 2-koloms lijst.
local function listCard(s)
    local r = tonumber(s.rating)
    local rstr = r and string.format("%.1f*", r) or "-"
    local dial = s.dial_in and " (d)" or ""
    local ratio = tonumber(s.brew_ratio)
    local rt = ratio and string.format("1:%.1f", ratio) or "?"
    local tm = tonumber(s.extraction_time_seconds) or 0
    local bean = (type(s.beans) == "table" and s.beans.name) or "?"
    return {
        string.format("%s  %s%s", fmtShort(s.created_at), rstr, dial),
        bean,
        string.format("%s->%s %s %ds m%s",
            num(s.dose_grams), num(s.yield_grams), rt, tm, num(s.grind_size)),
    }
end

-- ---------------------------------------------------------------------------
-- Rapport (voor de huidige month_offset)
-- ---------------------------------------------------------------------------

local function buildReport(shots_all)
    local cols = computeCols()
    local y, m = targetMonth(month_offset)
    local label = string.format("%s %d", MONTHS[m], y)

    local shots = {}
    for _, s in ipairs(shots_all or {}) do
        if inMonth(s.created_at, y, m) then shots[#shots + 1] = s end
    end

    local rule = string.rep("─", cols)
    local L = {}
    local function add(s) L[#L + 1] = s end

    -- Kop.
    add(spread("Espresso log", os.date("%d-%m-%Y %H:%M"), cols))
    add(rule)
    add("")

    if #shots == 0 then
        add(center("Geen shots in " .. label .. ".", cols))
        add("")
        add(center("Tik op 'Maand ‹' om terug te bladeren.", cols))
        return table.concat(L, "\n")
    end

    local st = computeStats(shots)

    -- Kerncijfers op één regel.
    local parts = {
        string.format("%d shots", st.total),
        string.format("%d bonen", st.beans),
    }
    if st.dialin > 0 then parts[#parts + 1] = string.format("%d dial-in", st.dialin) end
    if month_offset == 0 then
        local today = os.date("%Y-%m-%d")
        local tc = 0
        for _, s in ipairs(shots) do
            if dayKey(s.created_at) == today then tc = tc + 1 end
        end
        parts[#parts + 1] = string.format("vandaag %d", tc)
    end
    add(table.concat(parts, "   |   "))
    add("")

    -- Gemiddelden (meters vullen de breedte).
    add("GEMIDDELDEN")
    if st.avg_rating then
        add(meterLine(cols, "Rating", st.avg_rating / 5,
            string.format("%.1f/5", st.avg_rating)))
    end
    if st.avg_ratio then
        add(meterLine(cols, "Ratio", (st.avg_ratio - 1.5) / 1.5,
            string.format("1:%.1f", st.avg_ratio)))
    end
    if st.avg_time then
        add(meterLine(cols, "Tijd", (st.avg_time - 20) / 15,
            string.format("%ds", math.floor(st.avg_time + 0.5))))
    end
    if #st.ratings_chrono > 1 then
        add(string.format("%-7s%-6s ", "Trend", "")
            .. sparkline(st.ratings_chrono, math.max(4, cols - 14)))
    end
    add("")

    -- Hoogtepunten.
    add("HOOGTEPUNTEN")
    if st.best then
        add(string.format("%-13s%.1f  %s  %s", "Beste shot",
            st.best.rating, st.best.day, st.best.bean))
    end
    if st.top_bean then
        add(string.format("%-13s%s (%dx)", "Topboon", st.top_bean.name, st.top_bean.count))
    end
    add("")

    -- Verdeling rating + weekactiviteit naast elkaar.
    local half = math.floor((cols - 3) / 2)
    local bw = math.max(3, half - 8)

    local hmax = 1
    for i = 1, 5 do if st.hist[i] > hmax then hmax = st.hist[i] end end
    local wk = monthWeeks(shots)
    local wmax = math.max(wk.max, 1)

    local left = { "VERDELING RATING" }
    for i = 5, 1, -1 do
        left[#left + 1] = string.format("%d %s %d", i, bar(st.hist[i] / hmax, bw), st.hist[i])
    end
    local right = { "ACTIVITEIT (week)" }
    for i = 1, 5 do
        right[#right + 1] = string.format("w%d %s %d", i, bar(wk.counts[i] / wmax, bw), wk.counts[i])
    end
    for i = 1, 6 do
        add(padTrunc(left[i] or "", half) .. "   " .. (right[i] or ""))
    end
    add("")

    -- Shotlijst, 2 kolommen (zonder boxen, met dunne scheidingsregels).
    add(rule)
    local shown = math.min(CONFIG.list_limit, #shots)
    add(spread("SHOTS", string.format("%d van %d", shown, st.total), cols))
    add(rule)
    add("")

    local colw = math.floor((cols - 3) / 2)
    local cards = {}
    for i = 1, shown do cards[i] = listCard(shots[i]) end
    for i = 1, #cards, 2 do
        local lc, rc = cards[i], cards[i + 1]
        for line = 1, 3 do
            add(padTrunc(lc[line], colw) .. "   " .. (rc and padTrunc(rc[line], colw) or ""))
        end
        if i + 2 <= #cards then
            add("")
        end
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

openViewer = function(text)
    if viewer then
        UIManager:close(viewer)
        viewer = nil
    end
    local y, m = targetMonth(month_offset)
    viewer = TextViewer:new{
        title = string.format("%s %d", MONTHS[m], y),
        text = text,
        text_type = "code",            -- forceert monospace (cruciaal voor uitlijning)
        monospace_font = true,
        text_font_size = CONFIG.font_size,
        justified = false,
        width = Screen:getWidth(),     -- fullscreen i.p.v. dialoog-inset
        height = Screen:getHeight(),
        add_default_buttons = true,
        buttons_table = {
            {
                { text = "‹ Maand", callback = function()
                    month_offset = math.min(month_offset + 1, 120); renderCurrent()
                end },
                { text = "Nu", callback = function()
                    month_offset = 0; renderCurrent()
                end },
                { text = "Maand ›", callback = function()
                    month_offset = math.max(month_offset - 1, 0); renderCurrent()
                end },
            },
        },
        close_callback = function() viewer = nil end,
    }
    UIManager:show(viewer)
end

renderCurrent = function()
    if not cached_shots then return end
    cached_text = buildReport(cached_shots)
    openViewer(cached_text)
end

-- opts.show = open de viewer ook als hij nog dicht is
-- opts.silent = geen foutmeldingen (achtergrond-ververs)
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
    if type(data) ~= "table" then
        if not opts.silent then
            UIManager:show(InfoMessage:new{ text = _("Onverwacht antwoord van de server.") })
        end
        return
    end

    cached_shots = data
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
    month_offset = 0  -- altijd starten bij de huidige maand
    if cached_shots then
        cached_text = buildReport(cached_shots)
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
