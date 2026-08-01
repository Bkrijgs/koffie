# kobo-dashboard — standalone espresso-dashboard op de Kobo

Een eigen, klein programma dat het espresso-dashboard uit de koffie-app
rechtstreeks op het e-ink scherm van de **Kobo Aura HD** tekent. Het haalt de
shots uit Supabase (dezelfde bron als de web-app en de KOReader-plugin), rendert
een dashboard en toont dat met **FBInk**. Gestart via **KFMon** — Nickel en
KOReader blijven staan, dus alles is **omkeerbaar en zonder brick-risico**.

> Uitvoering van het plan in [`../docs/kobo-custom-dashboard-plan.md`](../docs/kobo-custom-dashboard-plan.md).

## Wat het toont

- Maand-header + "bijgewerkt om"-tijd
- Stat-tegels (shots, gem. rating, gem. ratio) + subregel (gem. tijd, dial-in, meest-geloogde boon)
- Rating-verdeling (1★–5★ balken)
- Activiteit per dag van de maand
- De laatste shots (boon, maalgraad, dose→yield, ratio, tijd, rating)

Bekijk het zonder toestel:

```bash
go run ./cmd/espresso -demo -out /tmp/dash.png && open /tmp/dash.png
```

## Status (fasering uit het plan)

| Fase | Wat | Status |
|---|---|---|
| 1 | Pijplijn: KFMon-tegel → Go-binary → FBInk | ✅ |
| 2 | Wifi + Supabase-fetch | ✅ |
| 3 | Dashboard renderen (`gg` → PNG → FBInk) | ✅ |
| 4 | Touch: maandnavigatie + shot-detail | ⏳ na `probe.sh` op het toestel |
| 5 | Polish: RTC-slaap, offline-gedrag | ⏳ |

Fase 4 heeft toestel-specifieke input-info nodig — draai daarvoor eerst
`probe.sh` **op** de Kobo (zie onder).

## Installeren (één commando op de Mac)

Kobo via USB aansluiten en op het toestel **Verbinden** tikken, daarna:

```bash
git pull && ./kobo-dashboard/install.sh
```

Dit cross-compileert de ARM-binary, regelt FBInk, kopieert alles naar
`/.adds/espresso/`, plaatst de KFMon-tegel, genereert het icoon en werpt de Kobo
uit. Daarna: USB loskoppelen → **Espresso**-tegel in de bibliotheek tikken.

> Lukt de automatische FBInk-download niet, dan zegt het script waar je de
> Kobo-`fbink` binary handmatig neerzet (`device/fbink`).

Updaten later = hetzelfde commando nog eens.

## Toestel-probe (voor fase 4)

Draai `probe.sh` **op de Kobo** (via KOReader's terminal, of SSH/telnet) en
bewaar de output — daarmee stel ik de touch-node en resolutie exact in.

## Architectuur

```
cmd/espresso/        entrypoint: splash → wifi → fetch → render → fbink, in een lus
internal/supabase/   PostgREST-client (HTTPS + JSON) — anon key, read-only
internal/stats/      port van computeStats/dayCounts uit de KOReader-plugin
internal/render/     dashboard tekenen met github.com/fogleman/gg
internal/wifi/       wifi aan/uit via de bestaande Kobo/KOReader-scripts
device/              launch.sh + KFMon-config (+ opgehaalde fbink)
install.sh           één-commando build + deploy op de Mac
probe.sh             eenmalige toestel-detectie (op de Kobo)
```

Pure Go, statisch gelinkt, geen cgo → cross-compilen kan direct vanaf de Mac
(`GOOS=linux GOARCH=arm GOARM=7`).

## Config

Supabase-URL + anon key staan in `internal/supabase/client.go` (`DefaultConfig`),
identiek aan `espressolog.koplugin/main.lua`. De anon key mag in de binary: RLS
staat alleen lezen toe.

## Batterij

Wifi gaat na elke fetch weer uit; standaard ververst het elke 3 uur
(`-interval` in `device/launch.sh`). Diepere slaap via de RTC-wekker is een
fase 5-verbetering.

## CLI

```
-demo            render voorbeelddata naar -out en stop (geen toestel nodig)
-hello           testframe tonen en stoppen (pijplijn-check op het toestel)
-once            één keer verversen en stoppen
-icon <pad>      launcher-icoon schrijven en stoppen
-interval <min>  verversinterval (default 180)
-offset <n>      n maanden terug (0 = deze maand)
-out <pad>       PNG-pad (default /tmp/espresso-dash.png)
```
