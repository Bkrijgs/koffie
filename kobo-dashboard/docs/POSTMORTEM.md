# Post-mortem #1 — kiosk-hang soft-brick

**Impact:** een Kobo Aura HD raakte vast in een blanco scherm na het inschakelen
van de kiosk-modus. Geen Nickel, geen USB, geen shell, geen werkende touch —
alleen nog te herstellen via de interne SD-kaart. Ruim een avond aan heen-en-weer.

## Wat er gebeurde
De kiosk-boot-hook startte de dashboard-binary vóór Nickel. De binary:
1. toonde een laadscherm + dashboard (2 e-ink "blinks"),
2. probeerde de touch-node te openen,
3. **bij een kale boot faalde dat (of leverde geen events op)**,
4. waarna de code `select{}` deed: **oneindig blijven hangen** "om het scherm vast
   te houden".

Daardoor:
- geen Nickel (de hook blokkeerde rcS in de foreground),
- geen USB-massaopslag (dat regelt Nickel),
- geen SSH (KOReader's server draait alleen ín KOReader),
- "Sluiten" werkte niet (hing aan de gefaalde touch),
- de crash-guard greep niet (de app *crashte* niet, hij *hing*).

Kortom: alle "escapes" hingen aan precies de dingen die stuk waren.

## Grondoorzaken (meervoud — dat is het punt)
1. **Eén-pad-denken bij recovery.** De enige geplande escape ("Sluiten") hing aan
   werkende touch. Eén faal-modus = volledige lock-out.
2. **Oneindig blokkeren op een onbewezen resource.** `select{}` op een toestel
   zonder gegarandeerde uitweg.
3. **Hardware-aannames niet geverifieerd vóór een onomkeerbare stap.** Touch bij
   kale boot was nooit getest; de framebuffer-diepte bleek per context te wisselen;
   de prebuilt fbink had geen image-support; oude FW had geen CA-store. Stuk voor
   stuk pas op het toestel ontdekt — terwijl de kiosk al "scherp" stond.
4. **Crash-guard met blinde vlek.** Hij ving alleen *snelle crashes*, niet *hangs*
   en niet *trage* exits.
5. **Refresh-fallback wiste het beeld** (`fbink -c`), wat een blanco scherm gaf
   zelfs als de rest klopte.

## Wat we hebben veranderd (failsafes, meerlaags)
- **Power-cycle escape (touch-vrij):** launcher telt boots; 3 boots zonder een
  geslaagde tik → kiosk uit → Nickel. De app wist de teller pas ná een echte tik
  (bewijs van interactiviteit), zodat normaal gebruik nooit vals triggert.
- **App hangt niet meer blind:** faalt touch in kiosk → `os.Exit`, zodat de
  launcher kan herstarten/terugvallen.
- **Crash-/hang-guard verhard:** N starts per boot → kiosk uit, ongeacht duur.
- **Bestand-gebaseerde escape gedocumenteerd:** `KIOSK_ENABLED` staat op de
  FAT-partitie en is via de SD in elke computer te wissen.
- **rcS-patch** met back-up, `sh -n`-validatie, rollback en mock-test (insert +
  strip → identiek bestand).
- **Geen scherm-wissende refresh meer** als "refresh".

## Blijvende regels
Zie `../CLAUDE.md`. Kort:
1. Geen Nickel-vervangende feature zonder ≥3 onafhankelijke, **touch-vrije** escapes.
2. Nooit oneindig blokkeren op een onbewezen resource.
3. Recovery schrijven en testen vóór de feature scherp staat — met alleen wat de
   gebruiker overhoudt als het misgaat.
4. Hardware-aannames = bugs tot op het toestel bewezen; driedubbelcheck fallbacks.

## Herstel van het getroffen toestel
Zie het recovery-plan in de chat / `README.md` ("Vastgelopen kiosk herstellen"):
interne SD eruit → FAT-partitie (`KOBOeReader`) op een computer mounten →
`.adds/espresso/KIOSK_ENABLED` verwijderen → SD terug → boot = Nickel.
