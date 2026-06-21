--[[
Espresso log — read-only KOReader-plugin (grafisch dashboard)

Een visueel maand-dashboard van je espresso-shots uit Supabase: stat-tegels,
echte voortgangsbalken, een pie van de rating-verdeling, een lijngrafiek van
de trend, een staafdiagram van de activiteit, en klikbare shotkaarten (2
kolommen) die een detailpopup met alle velden openen.

Data komt rechtstreeks van de Supabase REST API (PostgREST) via de anon key.
Ververst vers bij openen + automatisch elk uur via wifi. Maandnavigatie met de
knoppen onderaan.
--]]

-- ============================================================================
-- CONFIG
-- ============================================================================
local CONFIG = {
    base_url        = "https://wkbjugwavyebiurhuspa.supabase.co",
    anon_key        = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrYmp1Z3dhdnllYml1cmh1c3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzUyMzIsImV4cCI6MjA5MjkxMTIzMn0.w3K_QN2O3zqNFJa1-IfuA11zRxTYHFOFAmUkDxs8vsA",
    table           = "shots",
    list_limit      = 12,
    fetch_limit     = 2000,
    refresh_minutes = 60,
}
-- ============================================================================

local Blitbuffer      = require("ffi/blitbuffer")
local Button          = require("ui/widget/button")
local ButtonTable     = require("ui/widget/buttontable")
local CenterContainer = require("ui/widget/container/centercontainer")
local Device          = require("device")
local Dispatcher      = require("dispatcher")
local Font            = require("ui/font")
local FrameContainer  = require("ui/widget/container/framecontainer")
local Geom            = require("ui/geometry")
local GestureRange    = require("ui/gesturerange")
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan  = require("ui/widget/horizontalspan")
local InfoMessage     = require("ui/widget/infomessage")
local InputContainer  = require("ui/widget/container/inputcontainer")
local NetworkMgr      = require("ui/network/manager")
local ProgressWidget  = require("ui/widget/progresswidget")
local ScrollableContainer = require("ui/widget/container/scrollablecontainer")
local Size            = require("ui/size")
local TextBoxWidget   = require("ui/widget/textboxwidget")
local TextViewer      = require("ui/widget/textviewer")
local TextWidget      = require("ui/widget/textwidget")
local TitleBar        = require("ui/widget/titlebar")
local UIManager       = require("ui/uimanager")
local VerticalGroup   = require("ui/widget/verticalgroup")
local VerticalSpan    = require("ui/widget/verticalspan")
local Widget          = require("ui/widget/widget")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local logger          = require("logger")
local socket          = require("socket")
local socketutil      = require("socketutil")
local https           = require("ssl.https")
local ltn12           = require("ltn12")
local rapidjson       = require("rapidjson")
local _               = require("gettext")

local Screen = Device.screen
local function dp(x) return Screen:scaleBySize(x) end

-- Veilig tekenen: nooit buiten de schermbuffer schrijven (voorkomt segfaults
-- bij scrollen, want setPixel clampt zelf niet).
local function safePixel(bb, x, y, c)
    if x >= 0 and y >= 0 and x < bb:getWidth() and y < bb:getHeight() then
        bb:setPixel(x, y, c)
    end
end
local function safeRect(bb, x, y, w, h, c)
    if w <= 0 or h <= 0 then return end
    local bw, bh = bb:getWidth(), bb:getHeight()
    if x < 0 then w = w + x; x = 0 end
    if y < 0 then h = h + y; y = 0 end
    if x + w > bw then w = bw - x end
    if y + h > bh then h = bh - y end
    if w > 0 and h > 0 then bb:paintRect(x, y, w, h, c) end
end

local MONTHS = {
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
}

-- Grijstinten voor charts (e-ink): donker -> licht.
local GRAYS = {
    Blitbuffer.Color8(0x33),
    Blitbuffer.Color8(0x66),
    Blitbuffer.Color8(0x99),
    Blitbuffer.Color8(0xBB),
    Blitbuffer.Color8(0xDD),
}
local C_BLACK = Blitbuffer.COLOR_BLACK
local C_WHITE = Blitbuffer.COLOR_WHITE
local C_GRID  = Blitbuffer.Color8(0xCC)

local EspressoLog = WidgetContainer:extend{
    name = "espressolog",
    is_doc_only = false,
}

-- Module-level state.
local cached_shots = nil
local dash         = nil
local auto_task    = nil
local month_offset = 0

-- ---------------------------------------------------------------------------
-- Data-helpers
-- ---------------------------------------------------------------------------

local function num(n)
    n = tonumber(n)
    if not n then return "?" end
    if n == math.floor(n) then return string.format("%d", n) end
    return string.format("%.1f", n)
end

local function fmtShort(iso)
    if type(iso) ~= "string" then return "?" end
    local _y, mo, d, h, mi = iso:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+)")
    if not d then return iso end
    return string.format("%s-%s %s:%s", d, mo, h, mi)
end

local function fmtDateTime(iso)
    if type(iso) ~= "string" then return "?" end
    local y, mo, d, h, mi = iso:match("(%d+)-(%d+)-(%d+)T(%d+):(%d+)")
    if not d then return iso end
    return string.format("%s-%s-%s %s:%s", d, mo, y, h, mi)
end

local function avg(t)
    if #t == 0 then return nil end
    local s = 0
    for _, v in ipairs(t) do s = s + v end
    return s / #t
end

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

local function daysInMonth(y, m)
    local nm = m + 1
    local ny = y
    if nm > 12 then nm = 1; ny = ny + 1 end
    local t = os.date("*t", os.time{ year = ny, month = nm, day = 1, hour = 12 } - 86400)
    return t.day
end

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
            if not beans_seen[bn] then beans_seen[bn] = true; bean_count = bean_count + 1 end
            bean_counts[bn] = (bean_counts[bn] or 0) + 1
        end
        if not s.dial_in then
            local r = tonumber(s.rating)
            if r then
                table.insert(r_vals, r)
                table.insert(ratings_desc, r)
                local b = math.floor(r + 0.5)
                if b < 1 then b = 1 elseif b > 5 then b = 5 end
                hist[b] = hist[b] + 1
                if not best or r > best.rating then
                    best = { rating = r, bean = bn or "?" }
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

    local chrono = {}
    for i = #ratings_desc, 1, -1 do chrono[#chrono + 1] = ratings_desc[i] end

    return {
        total = #shots, dialin = dialin, beans = bean_count, effective = #r_vals,
        avg_rating = avg(r_vals), avg_ratio = avg(ratio_vals), avg_time = avg(time_vals),
        hist = hist, ratings_chrono = chrono, best = best,
        top_bean = top_name and { name = top_name, count = top_n } or nil,
    }
end

local function dayCounts(shots, y, m)
    local n = daysInMonth(y, m)
    local counts = {}
    for i = 1, n do counts[i] = 0 end
    local maxc = 0
    for _, s in ipairs(shots) do
        local d = tonumber((s.created_at or ""):match("%d+%-%d+%-(%d+)"))
        if d and counts[d] then
            counts[d] = counts[d] + 1
            if counts[d] > maxc then maxc = counts[d] end
        end
    end
    return counts, n, maxc
end

-- ---------------------------------------------------------------------------
-- Netwerk
-- ---------------------------------------------------------------------------

local function buildUrl()
    local sel = "created_at,dose_grams,yield_grams,brew_ratio,grind_size,"
        .. "extraction_time_seconds,rating,dial_in,notes,next_adjustment,tags,"
        .. "beans(name,roaster)"
    return string.format("%s/rest/v1/%s?select=%s&order=created_at.desc&limit=%d",
        CONFIG.base_url, CONFIG.table, sel, CONFIG.fetch_limit)
end

local function httpGet(url)
    local sink = {}
    socketutil:set_timeout(10, 30)
    local code, _h, status = socket.skip(1, https.request{
        url = url, method = "GET",
        headers = {
            ["apikey"] = CONFIG.anon_key,
            ["Authorization"] = "Bearer " .. CONFIG.anon_key,
            ["Accept"] = "application/json",
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

-- ===========================================================================
-- Custom chart-widgets (zelf getekend)
-- ===========================================================================

-- Donut/pie van de rating-verdeling.
local PieChart = Widget:extend{ d = 160, hist = nil }
function PieChart:getSize() return Geom:new{ w = self.d, h = self.d } end
function PieChart:paintTo(bb, x, y)
    pcall(function()
        local r = math.floor(self.d / 2)
        local cx, cy = x + r, y + r
        local total = 0
        for i = 1, 5 do total = total + (self.hist[i] or 0) end
        local bounds = {}
        if total > 0 then
            local acc = 0
            for i = 5, 1, -1 do
                acc = acc + (self.hist[i] or 0)
                bounds[i] = (acc / total) * 2 * math.pi
            end
        end
        local inner = r * 0.55
        local r2, in2 = r * r, inner * inner
        local edge2 = (r - 1.5) * (r - 1.5)
        for dyp = -r, r do
            for dxp = -r, r do
                local dist2 = dxp * dxp + dyp * dyp
                if dist2 <= r2 and dist2 >= in2 then
                    local color = C_GRID
                    if total > 0 then
                        local ang = math.atan2(dxp, -dyp)
                        if ang < 0 then ang = ang + 2 * math.pi end
                        color = GRAYS[1]
                        for i = 5, 1, -1 do
                            if ang <= bounds[i] then color = GRAYS[6 - i]; break end
                        end
                    end
                    if dist2 >= edge2 then color = C_BLACK end  -- dunne rand
                    safePixel(bb, cx + dxp, cy + dyp, color)
                end
            end
        end
    end)
end

-- Lijngrafiek van de rating-trend (chronologisch).
local LineChart = Widget:extend{ w = 300, h = 150, vals = nil }
function LineChart:getSize() return Geom:new{ w = self.w, h = self.h } end
function LineChart:paintTo(bb, x, y)
    pcall(function()
        local pad = dp(6)
        local x0, y0 = x + pad, y + pad
        local pw, ph = self.w - 2 * pad, self.h - 2 * pad
        for s = 1, 5 do
            local gy = y0 + ph - (s / 5) * ph
            safeRect(bb, x0, math.floor(gy), pw, 1, C_GRID)
        end
        local vals = self.vals
        local n = #vals
        if n < 1 then return end
        local function px(i) return x0 + (n == 1 and pw / 2 or (i - 1) / (n - 1) * pw) end
        local function py(v) return y0 + ph - (math.max(0, math.min(5, v)) / 5) * ph end
        for i = 1, n - 1 do
            local ax, ay = px(i), py(vals[i])
            local bx, by = px(i + 1), py(vals[i + 1])
            local steps = math.max(1, math.floor(math.max(math.abs(bx - ax), math.abs(by - ay))))
            for t = 0, steps do
                safeRect(bb, math.floor(ax + (bx - ax) * t / steps),
                    math.floor(ay + (by - ay) * t / steps), 2, 2, C_BLACK)
            end
        end
        for i = 1, n do
            safeRect(bb, math.floor(px(i)) - 1, math.floor(py(vals[i])) - 1, 4, 4, C_BLACK)
        end
    end)
end

-- Staafdiagram van shots per dag van de maand.
local BarChart = Widget:extend{ w = 300, h = 120, counts = nil, maxc = 1 }
function BarChart:getSize() return Geom:new{ w = self.w, h = self.h } end
function BarChart:paintTo(bb, x, y)
    pcall(function()
        local n = #self.counts
        if n < 1 then return end
        local maxc = math.max(self.maxc, 1)
        local pad = dp(4)
        local base = y + self.h - pad
        local avail = self.w - 2 * pad
        local gap = 1
        local bw = math.max(1, math.floor((avail - (n - 1) * gap) / n))
        local usable = self.h - 2 * pad
        safeRect(bb, x + pad, base, n * (bw + gap), 1, C_GRID)
        for i = 1, n do
            local c = self.counts[i]
            local bh = math.floor((c / maxc) * usable)
            local bx = x + pad + (i - 1) * (bw + gap)
            if bh > 0 then
                safeRect(bb, bx, base - bh, bw, bh, c > 0 and C_BLACK or C_GRID)
            end
        end
    end)
end

-- ===========================================================================
-- UI-bouwstenen
-- ===========================================================================

local FACE_BIG    = Font:getFace("cfont", 24)
local FACE_TILE   = Font:getFace("cfont", 30)
local FACE_LABEL  = Font:getFace("cfont", 14)
local FACE_TEXT   = Font:getFace("cfont", 17)
local FACE_SMALL  = Font:getFace("cfont", 15)
local FACE_HEAD   = Font:getFace("tfont", 18)

local function sectionTitle(text, width)
    return FrameContainer:new{
        bordersize = 0, padding = 0,
        padding_top = dp(8), padding_bottom = dp(4),
        TextWidget:new{ text = text, face = FACE_HEAD, bold = true },
    }
end

local function tile(value, label, w)
    return FrameContainer:new{
        bordersize = dp(1), radius = dp(6), padding = dp(8),
        margin = 0, background = C_WHITE, width = w,
        CenterContainer:new{
            dimen = Geom:new{ w = w - dp(18), h = dp(56) },
            VerticalGroup:new{
                align = "center",
                TextWidget:new{ text = value, face = FACE_TILE, bold = true },
                VerticalSpan:new{ width = dp(2) },
                TextWidget:new{ text = label, face = FACE_LABEL, fgcolor = Blitbuffer.Color8(0x55) },
            },
        },
    }
end

local function tilesRow(st, width)
    local gap = dp(8)
    local tw = math.floor((width - 3 * gap) / 4)
    local rating = st.avg_rating and string.format("%.1f", st.avg_rating) or "—"
    local hg = HorizontalGroup:new{
        tile(tostring(st.total), "shots", tw),
        HorizontalSpan:new{ width = gap },
        tile(tostring(st.beans), "bonen", tw),
        HorizontalSpan:new{ width = gap },
        tile(rating, "gem. rating", tw),
        HorizontalSpan:new{ width = gap },
        tile(tostring(st.dialin), "dial-in", tw),
    }
    return hg
end

local function meterRow(label, value, frac, width)
    local lw = dp(64)
    local vw = dp(64)
    local bw = width - lw - vw - dp(8)
    local pb = ProgressWidget:new{
        width = bw, height = dp(16),
        percentage = math.max(0, math.min(1, frac)),
        bordersize = dp(1), bordercolor = C_BLACK,
        bgcolor = C_WHITE, fillcolor = C_BLACK,
        radius = dp(3),
    }
    return HorizontalGroup:new{
        align = "center",
        FrameContainer:new{ bordersize = 0, padding = 0, width = lw,
            TextWidget:new{ text = label, face = FACE_TEXT } },
        pb,
        HorizontalSpan:new{ width = dp(8) },
        FrameContainer:new{ bordersize = 0, padding = 0, width = vw,
            TextWidget:new{ text = value, face = FACE_TEXT, bold = true } },
    }
end

-- Legenda-regel voor de pie.
local function pieLegend(st)
    local labels = {}
    for i = 5, 1, -1 do
        labels[#labels + 1] = FrameContainer:new{ bordersize = 0, padding = dp(2),
            TextWidget:new{ text = string.format("%d★ %d", i, st.hist[i]), face = FACE_SMALL } }
    end
    return VerticalGroup:new{ align = "left", unpack(labels) }
end

-- ---------------------------------------------------------------------------
-- Detailpopup (alle velden van één shot)
-- ---------------------------------------------------------------------------

local function showShotDetail(s)
    local function line(k, v) return string.format("%-14s%s", k, v) end
    local bean = (type(s.beans) == "table" and s.beans.name) or "?"
    if type(s.beans) == "table" and s.beans.roaster and s.beans.roaster ~= "" then
        bean = bean .. " — " .. s.beans.roaster
    end
    local ratio = tonumber(s.brew_ratio)
    local L = {
        line("Datum", fmtDateTime(s.created_at)),
        line("Boon", bean),
        "",
        line("Dose", num(s.dose_grams) .. " g"),
        line("Yield", num(s.yield_grams) .. " g"),
        line("Ratio", ratio and string.format("1:%.1f", ratio) or "?"),
        line("Tijd", (tonumber(s.extraction_time_seconds) or 0) .. " s"),
        line("Maalstand", num(s.grind_size)),
        line("Rating", s.rating and (num(s.rating) .. " / 5") or "—"),
        line("Dial-in", s.dial_in and "ja" or "nee"),
    }
    if type(s.tags) == "table" and #s.tags > 0 then
        L[#L + 1] = line("Tags", table.concat(s.tags, ", "))
    end
    if s.notes and s.notes ~= "" then
        L[#L + 1] = ""
        L[#L + 1] = "Notities:"
        L[#L + 1] = s.notes
    end
    if s.next_adjustment and s.next_adjustment ~= "" then
        L[#L + 1] = ""
        L[#L + 1] = "Volgende keer:"
        L[#L + 1] = s.next_adjustment
    end
    UIManager:show(TextViewer:new{
        title = fmtShort(s.created_at),
        text = table.concat(L, "\n"),
        text_type = "code",
        monospace_font = true,
        text_font_size = 18,
    })
end

-- Schermvullend dashboard-widget.
local Dashboard = InputContainer:extend{}
function Dashboard:onClose() UIManager:close(self); return true end
function Dashboard:onCloseWidget() end

-- Klikbare shotkaart.
local ShotCard = InputContainer:extend{ shot = nil, width = 200, height = 90 }
function ShotCard:init()
    self.dimen = Geom:new{ w = self.width, h = self.height }
    self.ges_events.Tap = { GestureRange:new{ ges = "tap", range = self.dimen } }
    local s = self.shot
    local r = tonumber(s.rating)
    local rstr = r and string.format("%.1f★", r) or "—"
    local dial = s.dial_in and "  (dial-in)" or ""
    local ratio = tonumber(s.brew_ratio)
    local rt = ratio and string.format("1:%.1f", ratio) or "?"
    local bean = (type(s.beans) == "table" and s.beans.name) or "?"
    local iw = self.width - dp(16)
    self[1] = FrameContainer:new{
        bordersize = dp(1), radius = dp(6), padding = dp(7),
        background = C_WHITE, width = self.width,
        VerticalGroup:new{
            align = "left",
            HorizontalGroup:new{
                TextWidget:new{ text = fmtShort(s.created_at), face = FACE_SMALL,
                    max_width = iw - dp(46) },
                HorizontalSpan:new{ width = dp(4) },
                TextWidget:new{ text = rstr, face = FACE_SMALL, bold = true },
            },
            TextWidget:new{ text = bean .. dial, face = FACE_TEXT, bold = true, max_width = iw },
            TextWidget:new{
                text = string.format("%s→%s g  %s  %ds  m%s",
                    num(s.dose_grams), num(s.yield_grams), rt,
                    tonumber(s.extraction_time_seconds) or 0, num(s.grind_size)),
                face = FACE_SMALL, max_width = iw },
        },
    }
end
function ShotCard:onTap()
    showShotDetail(self.shot)
    return true
end

-- ===========================================================================
-- Dashboard samenstellen
-- ===========================================================================

local buildDashboard  -- forward
local showDashboard   -- forward

buildDashboard = function(shots_all)
    local screenW, screenH = Screen:getWidth(), Screen:getHeight()
    local y, m = targetMonth(month_offset)
    local label = string.format("%s %d", MONTHS[m], y)

    local shots = {}
    for _, s in ipairs(shots_all or {}) do
        if inMonth(s.created_at, y, m) then shots[#shots + 1] = s end
    end

    local titlebar = TitleBar:new{
        width = screenW, fullscreen = true, align = "center",
        title = "Espresso log — " .. label,
        with_bottom_line = true,
        close_callback = function() UIManager:close(dash) end,
    }

    local buttontable = ButtonTable:new{
        width = screenW,
        buttons = { {
            { text = "‹ Maand", callback = function()
                month_offset = math.min(month_offset + 1, 120); showDashboard()
            end },
            { text = "Nu", callback = function()
                month_offset = 0; showDashboard()
            end },
            { text = "Maand ›", callback = function()
                month_offset = math.max(month_offset - 1, 0); showDashboard()
            end },
            { text = "Sluit", callback = function() UIManager:close(dash) end },
        } },
        show_parent = nil,
    }

    local cw = screenW - dp(20)  -- contentbreedte (met marge)
    local content = VerticalGroup:new{ align = "left" }
    local function add(w) table.insert(content, w) end
    local function gap(h) table.insert(content, VerticalSpan:new{ width = dp(h or 8) }) end

    if #shots == 0 then
        add(VerticalSpan:new{ width = dp(40) })
        add(CenterContainer:new{ dimen = Geom:new{ w = cw, h = dp(40) },
            TextWidget:new{ text = "Geen shots in " .. label .. ".", face = FACE_TEXT } })
    else
        local st = computeStats(shots)

        add(tilesRow(st, cw))
        gap(6)

        -- Meters
        add(sectionTitle("Gemiddelden", cw))
        if st.avg_rating then
            add(meterRow("Rating", string.format("%.1f/5", st.avg_rating), st.avg_rating / 5, cw))
            gap(4)
        end
        if st.avg_ratio then
            add(meterRow("Ratio", string.format("1:%.1f", st.avg_ratio), (st.avg_ratio - 1.5) / 1.5, cw))
            gap(4)
        end
        if st.avg_time then
            add(meterRow("Tijd", string.format("%ds", math.floor(st.avg_time + 0.5)), (st.avg_time - 20) / 15, cw))
        end
        gap(8)

        -- Pie (rating-verdeling) + legenda
        add(sectionTitle("Rating-verdeling", cw))
        local pied = math.min(dp(150), cw - dp(120))
        add(HorizontalGroup:new{
            align = "center",
            PieChart:new{ d = pied, hist = st.hist },
            HorizontalSpan:new{ width = dp(16) },
            pieLegend(st),
        })
        gap(8)

        -- Lijngrafiek trend
        if #st.ratings_chrono > 1 then
            add(sectionTitle("Trend rating", cw))
            add(LineChart:new{ w = cw, h = dp(130), vals = st.ratings_chrono })
            gap(8)
        end

        -- Staafdiagram activiteit
        local counts, _ndays, maxc = dayCounts(shots, y, m)
        add(sectionTitle("Activiteit per dag", cw))
        add(BarChart:new{ w = cw, h = dp(110), counts = counts, maxc = maxc })
        gap(8)

        -- Hoogtepunten
        if st.best or st.top_bean then
            add(sectionTitle("Hoogtepunten", cw))
            if st.best then
                add(TextWidget:new{ text = string.format("Beste: %.1f★  %s", st.best.rating, st.best.bean),
                    face = FACE_TEXT, max_width = cw })
            end
            if st.top_bean then
                add(TextWidget:new{ text = string.format("Topboon: %s (%dx)", st.top_bean.name, st.top_bean.count),
                    face = FACE_TEXT, max_width = cw })
            end
            gap(8)
        end

        -- Klikbare shots, 2 kolommen
        add(sectionTitle(string.format("Shots — %s (tik voor details)", label), cw))
        gap(2)
        local colgap = dp(8)
        local cardW = math.floor((cw - colgap) / 2)
        local cardH = dp(92)
        local shown = math.min(CONFIG.list_limit, #shots)
        local i = 1
        while i <= shown do
            local row = HorizontalGroup:new{ align = "top",
                ShotCard:new{ shot = shots[i], width = cardW, height = cardH } }
            if shots[i + 1] then
                table.insert(row, HorizontalSpan:new{ width = colgap })
                table.insert(row, ShotCard:new{ shot = shots[i + 1], width = cardW, height = cardH })
            end
            add(row)
            gap(6)
            i = i + 2
        end
    end

    -- Scrollbare body tussen titel en knoppen.
    local title_h = titlebar:getSize().h
    local btn_h = buttontable:getSize().h
    local body_h = screenH - title_h - btn_h
    local scroll = ScrollableContainer:new{
        dimen = Geom:new{ x = 0, y = 0, w = screenW, h = body_h },
        show_parent = nil,
        FrameContainer:new{
            bordersize = 0, padding = dp(10), padding_top = dp(6), padding_bottom = dp(6),
            content,
        },
    }

    local self_dash = Dashboard:new{
        dimen = Geom:new{ x = 0, y = 0, w = screenW, h = screenH },
        covers_fullscreen = true,
    }
    self_dash.cropping_widget = scroll
    self_dash[1] = FrameContainer:new{
        bordersize = 0, padding = 0, background = C_WHITE,
        width = screenW, height = screenH,
        VerticalGroup:new{ align = "left", titlebar, scroll, buttontable },
    }
    titlebar.show_parent = self_dash
    buttontable.show_parent = self_dash
    scroll.show_parent = self_dash
    return self_dash
end

showDashboard = function()
    local ok, result = pcall(function() return buildDashboard(cached_shots) end)
    if not ok then
        UIManager:show(InfoMessage:new{ text = "Espresso-dashboard fout:\n" .. tostring(result) })
        return
    end
    if dash then UIManager:close(dash) end
    dash = result
    UIManager:show(dash)
end

-- ---------------------------------------------------------------------------
-- Ophalen
-- ---------------------------------------------------------------------------

local function doRefresh(opts)
    opts = opts or {}
    local body, err = httpGet(buildUrl())
    if not body then
        logger.warn("espressolog: fetch mislukt:", err)
        if not opts.silent then
            UIManager:show(InfoMessage:new{ text = _("Kon de espresso-log niet ophalen:\n") .. err })
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
    if opts.show or dash then showDashboard() end
end

local function setupAutoRefresh()
    if auto_task then UIManager:unschedule(auto_task); auto_task = nil end
    local minutes = CONFIG.refresh_minutes or 0
    if minutes <= 0 then return end
    local interval = minutes * 60
    auto_task = function()
        NetworkMgr:runWhenOnline(function() doRefresh({ silent = true }) end)
        UIManager:scheduleIn(interval, auto_task)
    end
    UIManager:scheduleIn(interval, auto_task)
end

function EspressoLog:showLog()
    month_offset = 0
    if cached_shots then showDashboard() end
    NetworkMgr:runWhenOnline(function() doRefresh({ show = true }) end)
end

-- ---------------------------------------------------------------------------
-- Registratie
-- ---------------------------------------------------------------------------

function EspressoLog:onDispatcherRegisterActions()
    Dispatcher:registerAction("show_espresso_log", {
        category = "none", event = "ShowEspressoLog",
        title = _("Espresso log"), general = true,
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
        callback = function() self:showLog() end,
    }
end

function EspressoLog:onShowEspressoLog()
    self:showLog()
    return true
end

return EspressoLog
