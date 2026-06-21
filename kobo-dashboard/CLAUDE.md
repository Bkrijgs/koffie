# kobo-dashboard — werkregels (LEES DIT EERST)

Dit project draait op fysieke Kobo-hardware (Aura HD, "dragon", FW 4.38,
kernel 2.6.35). Een fout kan een toestel **soft-bricken** dat alleen via de
interne SD te redden is. Werk daarom defensief en **driedubbelcheck fallback-
en recovery-routes** voordat je iets uitrolt dat de boot of het hoofdscherm
raakt.

## Harde regels (niet onderhandelbaar)

1. **Nooit iets uitrollen dat Nickel vervangt/onderschept zonder ≥3 onafhankelijke,
   touch-vrije escapes terug naar Nickel.** Touch is GEEN garantie — bij een kale
   boot kan de touch-node anders zijn of nog niet bestaan. Verplichte escapes voor
   kiosk-achtige features:
   - **Power-cycle teller** (bv. 3x booten zonder geslaagde interactie → uit),
   - **Crash-/hang-guard** in de launcher (N starts per boot → uit),
   - **Bestand verwijderen** dat op de FAT-partitie staat (bereikbaar via de SD,
     ook zonder Nickel/USB).
   De in-app knop ("Sluiten") telt NIET als failsafe — die hangt aan werkende touch.

2. **Een proces mag nooit oneindig blokkeren (`select{}`, hang) op een toestel
   zonder bewezen uitweg.** Faalt een resource (touch, framebuffer, netwerk),
   dan: log + exit met code, zodat een launcher kan herstellen/terugvallen.

3. **Recovery vóór functionaliteit.** Vóór je een boot-/UI-hook activeert: schrijf
   en TEST eerst de uitschakel-/herstelroute. Verifieer dat recovery werkt met
   ALLEEN datgene wat de gebruiker nog heeft als het misgaat (geen SSH, geen USB,
   geen shell). Op Kobo betekent dat meestal: een bestand op de FAT-partitie dat
   óók via de SD-kaart in een willekeurige computer te wissen is.

4. **Aannames over hardware = bugs tot bewezen.** Verifyer altijd op het echte
   toestel, niet vanuit aannames:
   - framebuffer bit-diepte/formaat **wisselt** per context (Nickel=32bpp BGRA,
     KOReader=8bpp Y8) — lees runtime uit en ondersteun alle gevallen.
   - touch-assen/maxima zijn per toestel anders — kalibreer met `-touchtest`.
   - prebuilt `fbink` op het toestel is vaak **minimaal** (geen image-support);
     vertrouw niet op `-g`.
   - oude firmware mist een bruikbare CA-store → TLS faalt; bundel CA's in de binary.

5. **Nooit een terugval-pad gebruiken dat het scherm/data wist** (zoals
   `fbink -c`) als "refresh". Een refresh mag het beeld nooit weggooien.

6. **Idempotent, met back-up, met syntax-check, met rollback** voor elke wijziging
   aan systeembestanden (bv. `/etc/init.d/rcS`). Test de patch op een mock én
   met `sh -n` vóór je 'm wegschrijft; rol terug bij twijfel.

## Vaste device-feiten (Aura HD "dragon")
- Scherm 1080x1440. fb soms 8bpp Y8, soms 32bpp BGRA, line length wisselt.
- Touch: `/dev/input/event1`, assen geswapt + X geïnverteerd, max ~1400x1025.
- Nickel start in `/etc/init.d/rcS` (regel ~295: `… /usr/local/Kobo/nickel …`).
- Geen externe boot-SD; interne microSD onder de achterkant (FAT-partitie =
  `KOBOeReader`, leesbaar op macOS).
- KIOSK-vlag: `/mnt/onboard/.adds/espresso/KIOSK_ENABLED` (FAT → via SD wisbaar).

## Workflow
- Cross-compile: `CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7`.
- Render off-device met `-preview` en bekijk de PNG vóór je naar hardware gaat.
- `go vet ./... && gofmt -l . && go test ./...` groen houden.

> Zie `docs/POSTMORTEM.md` voor incident #1 (kiosk-hang soft-brick) — de directe
> aanleiding voor deze regels.
