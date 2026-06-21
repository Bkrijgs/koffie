# Plan — "Volledig eigen software" op de Kobo (standalone espresso-dashboard)

> **Doel van dit document:** dit is een zelfstandige brief. Je kunt het in een
> **nieuwe chat** openen; de agent leest de repo uit, scaffold't een nieuw
> project (`kobo-dashboard/`) en levert één install-commando waarmee álles
> (binary + e-ink lib + launcher + wifi + config) in één keer op de Kobo komt.
> Onderaan staat een kant-en-klare **kickoff-prompt**.

---

## 1. Context
- Er bestaat een werkend grafisch espresso-dashboard als **KOReader-plugin**:
  `espressolog.koplugin/main.lua`. Dat leest shots uit Supabase (PostgREST,
  anon key) en tekent tegels, voortgangsbalken, pie/lijn/staaf-charts en
  klikbare shotkaarten met detailpopup.
- De plugin leunt op KOReader voor e-ink, touch, wifi, TLS en fonts.
- De wens: **eigen software** op de Kobo die alléén dit dashboard + wifi doet,
  zonder KOReader's UI eromheen.

## 2. Wat "eigen software" realistisch betekent (lees dit eerst)
Het toestel (hier een **Kobo Aura HD**, codename `dragon`, framebuffer
1080×1440, armhf i.MX) is embedded Linux. De échte moeilijkheid zit niet in het
dashboard maar in de **platformlaag**: e-ink refresh (i.MX EPDC waveform-modes),
touch (evdev), wifi (kernelmodule + wpa_supplicant + udhcpc), TLS/HTTPS, fonts.

**Aanbevolen, veilige interpretatie:** een **standalone app** die we via de al
geïnstalleerde **KFMon**-launcher starten, met **Nickel en KOReader blijven
staan** als recovery/fallback. Dat geeft het "eigen apparaat"-gevoel,
**zonder firmware te vervangen → geen brick-risico → omkeerbaar**.

> Nickel écht verwijderen / als boot-target vervangen kan later, maar is riskant
> (brick, reflash nodig) en staat als **optionele** fase 6 onderaan.

## 3. Aanbevolen architectuur
- **Taal: Go** — één statische ARM-binary, ingebouwde **TLS** (HTTPS naar
  Supabase) en **JSON**, triviale cross-compile (`GOOS=linux GOARCH=arm
  GOARM=7`), geen runtime-deps. Cross-compilen kan **direct vanaf de Mac**
  (pure Go, geen cgo) — dat maakt de build simpel.
- **E-ink tekenen: FBInk** (github.com/NiLuJe/FBInk). Twee opties; kies de
  simpele:
  - **Aanrader (pure Go, geen cgo):** render het hele scherm met een Go
    imaging-lib (bijv. `github.com/fogleman/gg` → anti-aliased tekst, pie,
    lijnen) naar een PNG/raw, en blit dat met de **`fbink` CLI**
    (`fbink -g file=/tmp/dash.png`) inclusief refresh. Geen C-toolchain nodig.
  - Alternatief (later): `libfbink` via cgo voor strakkere integratie (vereist
    **koxtoolchain**). Niet nodig voor MVP.
- **Touch: evdev** rechtstreeks lezen uit `/dev/input/eventX` in Go
  (input_event-structs decoderen, ABS_MT_POSITION_X/Y + BTN_TOUCH). Hit-targets
  = shotkaarten, maand-knoppen, sluitknop. Inputnode + rotatie per toestel
  bepalen met `fbink_input_scan` (eenmalige probe).
- **Wifi:** hergebruik de scripts die al op het toestel staan —
  `.adds/koreader/enable-wifi.sh` / `disable-wifi.sh` (we zagen ze al), of
  repliceer ze (insmod wifi-module → wpa_supplicant → udhcpc). App roept wifi-up
  aan vóór het ophalen.
- **Launcher: KFMon** — een config in `.adds/kfmon/config/espresso.ini` die een
  pictogram toont dat ons launch-script start (net als KOReader). Optioneel
  later: KFMon auto-start = kiosk.
- **Refresh-strategie:** vers ophalen bij start + elke ~uur (toestel hangt aan
  de lader). Volledige frame-render per update (e-ink); partial refresh optioneel.

## 4. Herbruikbare onderdelen (NIET opnieuw uitvinden)
- **FBInk** — prebuilt binaries (MobileRead) of zelf bouwen; ondersteunt Aura HD.
- **KFMon** — al geïnstalleerd; alleen een extra `.ini` + icoon toevoegen.
- **Kobo wifi-scripts** — `.adds/koreader/enable-wifi.sh` / `disable-wifi.sh`.
- **Bestaande dashboard-logica + Supabase-config** uit
  `espressolog.koplugin/main.lua` (porten naar Go):
  - Project-URL + anon key (in het `CONFIG`-blok bovenin de plugin).
  - PostgREST-query met `beans(name,roaster)`-embed, `order=created_at.desc`.
  - Stats (gemiddelden zonder dial-in), maand-filter + navigatie, charts,
    detailvelden (incl. `notes`, `next_adjustment`, `tags`).
  - **Let op:** `NULL`-velden komen in JSON als `null` — in Go gewoon nil/zero
    (geen rapidjson-userdata-valkuil zoals in Lua).
- **Schema** (echte kolommen): `supabase/migrations/0001_init.sql` →
  `public.shots(created_at, bean_id, grind_size, dose_grams, yield_grams,
  brew_ratio, extraction_time_seconds, rating, dial_in, notes, next_adjustment,
  tags)` met FK `bean_id → public.beans(name, roaster)`. RLS `anon read shots`
  bestaat al.

## 5. Te scaffolden projectstructuur (`kobo-dashboard/`)
```
kobo-dashboard/
  go.mod
  cmd/espresso/main.go        # entrypoint: wifi up -> fetch -> render-loop -> touch
  internal/supabase/          # PostgREST-client (HTTPS + JSON, structs)
  internal/stats/             # gemiddelden, histogram, trend, activiteit (port uit Lua)
  internal/render/            # gg-render: tegels, meters, pie, lijn, staaf, kaarten, detail
  internal/input/             # evdev-reader + hit-testing
  internal/wifi/              # wifi up/down (roept Kobo-scripts of replica)
  assets/fonts/               # gebundeld TTF (bijv. een vrij font)
  device/
    fbink                     # prebuilt FBInk-binary (armhf) — door install opgehaald
    launch.sh                 # KFMon start-script (wifi up, draait de binary)
    kfmon/espresso.ini        # KFMon launcher-config
    icon.png                  # bibliotheek-pictogram
  install.sh                  # ÉÉN commando: build + bundle + deploy + kfmon + eject
  probe.sh                    # eenmalige device-probe (fb-info, inputnode, wifi-iface)
  .github/workflows/build.yml # (optioneel) CI cross-compile -> Release-artifact
  README.md
```

## 6. De één-keer-plakken workflow
**Eenmalig vereist op de Mac:** Go (`brew install go`) — pure-Go cross-compile
heeft verder niets nodig.

**Installeren / updaten — één commando** (Kobo via USB aangesloten + *Verbinden*):
```bash
cd "$(find ~ -maxdepth 5 -type d -name koffie 2>/dev/null | head -1)" \
  && git pull \
  && ./kobo-dashboard/install.sh
```

`install.sh` doet **alles** in één run:
1. **Build**: `GOOS=linux GOARCH=arm GOARM=7 go build -o build/espresso ./cmd/espresso`.
2. **FBInk ophalen** (indien nog niet aanwezig): download de armhf `fbink`-binary
   van de officiële FBInk-releases (publiek, geen auth) naar `device/fbink`.
3. **Deploy**: kopieer binary + `fbink` + fonts + `launch.sh` naar
   `/Volumes/KOBOeReader/.adds/espresso/`.
4. **Launcher**: plaats `kfmon/espresso.ini` in `.adds/kfmon/config/` en het
   icoon, zodat er een **Espresso**-tegel in de bibliotheek verschijnt.
5. **Eject** het volume.

Daarna: Kobo loskoppelen → **Espresso**-tegel tikken (of, na kiosk-config, boot
direct erin). Geen losse stappen, geen plakwerk per bestand.

> Eerste keer ook even `./kobo-dashboard/probe.sh` (genereert een
> `device-profile` met fb-info + inputnode + wifi-iface) zodat de app op dít
> toestel klopt. Dit kan in `install.sh` worden ingebouwd zodat het ook één
> commando blijft.

## 7. Build/CI (optioneel)
Lokale build vanaf de Mac is voldoende (pure Go). Wil je releases:
`.github/workflows/build.yml` cross-compileert bij een tag en publiceert een
zip-artifact; `install.sh` kan dan kiezen tussen "lokaal bouwen" of "release
downloaden".

## 8. Fasering (milestones)
1. **MVP-pijplijn**: `install.sh` + KFMon-tegel die een Go-binary start die met
   FBInk "Hello espresso" toont. Bewijst build+deploy+launch+e-ink.
2. **Data**: wifi up + Supabase-fetch + structs; toon ruwe cijfers als tekst.
3. **Render**: dashboard met `gg` (tegels, meters, pie, lijn, staaf) → PNG → fbink.
4. **Interactie**: evdev-touch → maandnavigatie + shotkaart → detailkaart.
5. **Polish**: uur-refresh, foutafhandeling/offline, batterij/slaap-gedrag.
6. **(Optioneel, riskant)** Kiosk/boot-to-app, of Nickel als boot-target
   vervangen — alleen met een geteste recovery (reflash-image klaar).

## 9. Risico's & recovery
- Zolang we **via KFMon** draaien en Nickel/KOReader laten staan: geen
  brick-risico, volledig omkeerbaar (config + map weghalen).
- Touch/wifi zijn toestel-specifiek → de `probe.sh`-stap dekt dit af.
- Voor de optionele boot-vervanging: eerst een **factory/reset-image** van de
  Aura HD klaarzetten en de herstelprocedure documenteren vóór je eraan begint.

## 10. Verificatie
- Na `install.sh`: tegel verschijnt → tik → e-ink toont dashboard binnen enkele
  seconden (wifi-prompt/auto), data klopt met de web-app.
- Touch: tik op een shot → detailkaart; maand-knoppen wisselen data.
- Stabiliteit: laten staan, na ~1 uur is de data ververst; geen crash bij
  scrollen/tikken.
- Vergelijk cijfers met de bestaande KOReader-plugin als referentie.

## 11. Open beslissingen (vóór of vroeg in de nieuwe chat te bevestigen)
- Bevestig device-codename/resolutie via `probe.sh` (verwacht Aura HD `dragon`,
  1080×1440).
- Render-aanpak: pure Go + `fbink` CLI (aanrader) vs. `libfbink` via cgo.
- Wel/niet kiosk-autostart in fase 1, of pas later.
- Anon key in de binary embedden (zelfde key als de plugin; RLS = read-only).

---

## 12. Kickoff-prompt voor een NIEUWE chat (kopieer dit)
```
Lees in deze repo het plan `docs/kobo-custom-dashboard-plan.md` en de bestaande
KOReader-plugin `espressolog.koplugin/main.lua` (daarin staan de Supabase
project-URL + anon key, de PostgREST-query en de dashboard-/stats-logica), plus
het schema in `supabase/migrations/0001_init.sql`.

Doel: bouw volgens dat plan een STANDALONE Kobo-app `kobo-dashboard/` in Go die
het espresso-dashboard rendert met FBInk en via KFMon start (Nickel/KOReader
blijven staan als fallback). Het toestel is een Kobo Aura HD ("dragon",
1080x1440, armhf).

Lever:
1. Het volledige project `kobo-dashboard/` (structuur zoals in sectie 5 van het
   plan), met de dashboard-logica geport uit de Lua-plugin (zelfde Supabase-
   config, stats zonder dial-in, maandnavigatie, charts, detailvelden incl.
   notes/next_adjustment/tags).
2. Een `install.sh` die in ÉÉN run: de Go-binary cross-compileert
   (GOARCH=arm GOARM=7) op de Mac, de prebuilt `fbink` ophaalt, alles naar
   `/Volumes/KOBOeReader/.adds/espresso/` kopieert, een KFMon-tegel installeert
   en het volume ejectt.
3. Een `probe.sh` voor een eenmalige device-detectie (fb-info, touch-inputnode,
   wifi-interface).
4. Werk gefaseerd (sectie 8): begin met de MVP-pijplijn (KFMon-tegel → Go-binary
   → "Hello espresso" via fbink) zodat build+deploy+launch eerst bewezen zijn,
   en bouw daarna data → render → touch → polish.

Werk op een nieuwe feature-branch, commit en push per fase. Houd alles zo dat ik
op de Mac maar ÉÉN commando hoef te plakken om te (her)installeren.
```

---

### Samenvattend
- **Veilig pad** = eigen Go-app + FBInk, gestart via KFMon, Nickel blijft.
- **Eén-paste install** = `git pull && ./kobo-dashboard/install.sh` (build +
  fbink + deploy + KFMon + eject).
- **Herbruikbaar** = FBInk (e-ink/touch), KFMon (launcher), Kobo wifi-scripts,
  en alle dashboard-/Supabase-logica uit de bestaande plugin.
