# kobo-dashboard — standalone espresso dashboard voor Kobo

Een zelfstandige Kobo-app (Go + FBInk) die het espresso-dashboard rendert op
e-ink en via **KFMon** start. Nickel en KOReader blijven gewoon staan als
fallback — deze tegel is puur additief.

Doeltoestel: **Kobo Aura HD** (`dragon`, 1080×1440, armhf).

## Eén commando om te (her)installeren

Sluit de Kobo aan via USB en draai op de Mac:

```sh
./kobo-dashboard/scripts/install.sh
```

Dat cross-compileert de Go-binary (`GOARCH=arm GOARM=7`), haalt de prebuilt
`fbink` op, kopieert alles naar `/Volumes/KOBOeReader/.adds/espresso/`,
installeert de KFMon-tegel en ejectt het volume. Daarna verschijnt er een
**Espresso**-tegel in de bibliotheek; tik die aan om het dashboard te starten.

### Device-detectie (eenmalig)

De app heeft een paar hardware-specifieke instellingen (touch-node,
as-oriëntatie, wifi-interface). Draai `probe.sh` één keer op het toestel om die
te detecteren en een `device.conf` te schrijven:

```sh
# op de Kobo (SSH/telnet via USBNet/KSM):
sh /mnt/onboard/.adds/espresso/probe.sh    # of: scp probe.sh erheen en draai 'm
```

Zonder `device.conf` gebruikt de app de Aura-HD-defaults. Landen taps op de
verkeerde plek, pas dan `TOUCH_SWAP_XY` / `TOUCH_INVERT_*` in `device.conf` aan.

## Wanddisplay-modus (`-wall`)

Voor een vast, altijd-aan paneel op de machine (aan de stroom) start de launcher
de app met **`-wall`**:

- **Sluit nooit vanzelf af** (geen 5-min idle-timeout).
- **Ververst zichzelf** elk uur, en zet daarvoor best-effort de wifi even aan
  (hergebruikt KOReader/KFMon's `enable-wifi.sh`).
- **Houdt het laatste dashboard vast** als een verversing faalt (cache), dus je
  blijft nooit op een leeg laadscherm hangen.
- Terug naar Nickel = **power-cycle** (geen boot-hook, dus altijd veilig).

De launcher `kfmon/run.sh` is een **supervisor**: crasht of stopt de binary ooit,
dan herstart 'ie automatisch (met backoff), zodat de tegel aantikken áltijd in
een draaiend dashboard eindigt. Een panic in de binary wordt opgevangen en toont
een leesbaar foutscherm i.p.v. stil te sterven. `touch STOP` naast `run.sh` stopt
de supervisor netjes (gebruikt door `deploy-ssh.sh` tijdens een update).

## Draadloos updaten (zonder USB)

Voor een ingeklikt wanddisplay is USB onhandig. Update over wifi via SSH:

```sh
# start eenmalig KOReader's SSH-server (Menu → SSH server) en lees IP + poort af,
# daarna op de Mac:
./kobo-dashboard/scripts/deploy-ssh.sh <kobo-ip>
```

Dat cross-compileert, pusht de nieuwe binary + launcher over wifi (met `cat`
over SSH, dus geen scp op het toestel nodig) en herstart de app in
wanddisplay-modus.

## Vastgelopen kiosk herstellen

De kiosk heeft meerdere **touch-vrije** uitwegen terug naar Nickel:

1. **Power-cycle 3×** — zet 'm 3 keer aan/uit zonder dat het scherm reageert; de
   launcher schakelt de kiosk dan automatisch uit en boot Nickel.
2. **Sluiten** — linksonder in de app (als touch werkt).
3. **Vlag wissen via de SD** — wanneer niets anders kan: interne microSD eruit
   (onder de achterkant), de **`KOBOeReader`**-partitie op een computer mounten en
   `\.adds/espresso/KIOSK_ENABLED` verwijderen. SD terug → boot = Nickel.
4. Terug in Nickel: `sh /mnt/onboard/.adds/espresso/kiosk-uninstall.sh` zet de
   boot-hook helemaal terug.

> Achtergrond: zie `docs/POSTMORTEM.md`. De power-cycle-escape is er gekomen na
> incident #1, waarbij een oudere versie zonder touch-vrije uitweg vastliep.

## Projectstructuur

```
kobo-dashboard/
├── cmd/espresso/         # entry point (main.go)
├── internal/
│   ├── config/           # Supabase-config + device.conf parsing
│   ├── supa/             # Supabase/PostgREST client (beans + shots)
│   ├── model/            # Bean / Shot / Rating types
│   ├── stats/            # dashboard-logica: effective shots, maand, charts
│   ├── render/           # PNG-rendering (canvas, dashboard, fbink-wrapper)
│   └── input/            # touch (evdev) afhandeling
├── kfmon/
│   ├── espresso.ini      # KFMon watch-config
│   └── run.sh            # on-device launcher
├── scripts/
│   ├── install.sh        # Mac: build + deploy + KFMon-tegel + eject
│   └── probe.sh          # device: fb-info, touch-node, wifi detectie
├── assets/icon.png       # KFMon tile-cover
└── README.md
```

## Hoe het rendert

De binary is **pure Go (geen CGO)** en tekent het hele scherm (1080×1440,
grijswaarden) naar een PNG, die vervolgens met `fbink -g` op de e-ink wordt
geblit. Dat is de meest stabiele FBInk-route over firmwareversies heen, en het
laat exact dezelfde PNG ook op een dev-machine renderen (`-preview`).

```sh
go run ./cmd/espresso -preview -out /tmp/dash.png   # render zonder fbink
```

## Data

Dezelfde Supabase-backend als de web-app en de KOReader-plugin: de publieke
project-URL + anon-key staan in `internal/config`. De anon-key is een
publishable token achter row-level-security (anon read), dus veilig om mee te
leveren. Het dashboard leest `beans` en `shots` via PostgREST.

> Noot: dit project is geport uit de bestaande `koffie` Next.js-app (de
> stats-/dashboard-logica in `lib/` en `components/`) — die is de bron van
> waarheid voor de berekeningen (effective shots zonder dial-in, gemiddelden,
> tips, heatmap-buckets).

## Gefaseerde opbouw

1. **MVP-pijplijn** — KFMon-tegel → Go-binary → "Hello espresso" via fbink.
   Bewijst build + deploy + launch + display. ✅
2. **Data** — Supabase/PostgREST: beans + shots ophalen + cachen. ✅
3. **Render** — volledig dashboard: stats (zonder dial-in), maandnavigatie,
   charts, recente shots met detailvelden (notes / next_adjustment / tags). ✅
4. **Touch** — evdev: maand vooruit/terug, refresh, afsluiten. ✅
5. **Polish** — barista-inzichten (globalTips uit lib/tips.ts), laad-splash,
   offline-cache + foutstaten, visuele verfijning. ✅

### Bediening (touch)

- **‹ / ›** (boven): vorige / volgende maand.
- **Ververs** (onder, midden): opnieuw ophalen uit Supabase.
- **Sluiten** (onder, links): terug naar Nickel.
- Na 5 min zonder aanraking sluit de app automatisch af.

Landt een tik naast de knop? De touch-as-oriëntatie van de Aura HD verschilt
per toestel; pas `TOUCH_SWAP_XY` / `TOUCH_INVERT_X` / `TOUCH_INVERT_Y` in
`device.conf` aan (zie `probe.sh`).
