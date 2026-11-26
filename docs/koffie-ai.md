# Koffie AI — context & roadmap

Levend document voor de "inwendige koffie-AI": het systeem dat op basis van
gelogde shots adviseert wat je de volgende keer het beste kunt doen,
machine-specifiek. Hier staan de setup, de gemaakte keuzes en het plan, zodat
we er altijd op terug kunnen vallen.

## Setup van de gebruiker

| | |
|---|---|
| Machine | Sage Barista Express |
| Maler | Ingebouwd (conische burr) |
| Maalgraad-schaal | 1–16 (buitenring; 1 = fijn, 16 = grof) |
| Basket | Meestal dubbel — af te leiden uit de dose (>14 g ≈ dubbel) |
| Pressurized basket | Nooit |
| Drukmeter | Ja, met low-pressure pre-infusion |
| PID temperatuur | Nee (Barista Express base) |
| Weegt dose + yield | Ja, alles op de weegschaal |

## Beslissingen

1. **Maalgraad wordt numeriek.** Was vrije tekst (`"5"`, `"fijner"`), wordt een
   getal op de schaal uit de setup. Pas dan kan de AI precies rekenen
   ("ga van 5 naar 4"). Bestaande data (`3,4,5,6,9`) is al numeriek — risicoloze
   migratie.
2. **LLM-route.** De gebruiker koopt tokens; toekomstbestendiger dan puur
   heuristiek. Endpoint wordt provider-agnostisch opgezet.
   - Aanbeveling: **Anthropic Claude** (Haiku 4.5 — goedkoop, prima redeneren;
     Sonnet voor zwaardere analyse). OpenAI kan ook — gebruiker heeft daar
     credits. Keuze definitief maken bij Fase 3.
   - **API-key NOOIT in git.** Komt in Vercel env vars (`ANTHROPIC_API_KEY`
     of `OPENAI_API_KEY`).
3. **Smaakvoorkeur is variabel, volledig data-gedreven.** Geen hardcoded
   "jij houdt van X". De AI leidt voorkeur af uit welke shots de gebruiker
   hoog beoordeelt.
4. **Feedback-loop.** Bij een nieuwe shot vraagt de app of de vorige
   `nextAdjustment` is uitgevoerd, zodat de engine oorzaak→gevolg leert.
5. **Onderhoudskosten zijn een aparte entiteit (`expenses`).** Bonenkosten
   blijven afgeleid van `priceEuros`/`bagWeightGrams` op de boon; een
   waterfilter of Cafiza hangt aan niets. Bonen zijn daarom bewust géén
   uitgave-categorie — anders tel je ze dubbel.
6. **Apparatuur telt niet mee in de maandcijfers.** Categorie `apparatuur`
   (machine, molen, tamper) is een eenmalige investering en krijgt een eigen
   "geïnvesteerd"-totaal. Zou je die in de maandbalk gooien, dan zegt één
   piek van een paar honderd euro niets meer over wat koffie normaal kost.
   `onderhoud` en `overig` zijn wél lopende kosten en tellen mee.
7. **"Bonen/shot" blijft puur bonen.** Onderhoud erin verwerken zou de tegel
   onbruikbaar maken om bonen onderling te vergelijken. Het gecombineerde
   beeld staat in "Deze maand" en "Totaal".

## Waar wordt wat bewaard

- **Apparatuur-setup** → app-data (`setup`-tabel in Supabase + localStorage
  fallback), bewerkbaar via `/instellingen`. De AI krijgt dit als context mee.
- **Uitgaven** → `expenses`-tabel in Supabase + localStorage fallback
  (`koffie:expenses:v1`), bewerkbaar via `/kosten`. Bedragen als `numeric`
  euro's, net als `beans.price_euros`.
- **Ontwerpbeslissingen & architectuur** → dit document (`docs/koffie-ai.md`),
  in git.
- **API-keys** → Vercel env vars, nooit in git, nooit in dit document.

## Architectuur

- Storage-abstractie (`lib/storage.ts`) blijft de bron: Supabase indien
  geconfigureerd, anders localStorage.
- LLM-advies draait via een **Next.js API-route** (`app/api/coach/route.ts`),
  die op Vercel de env-var-key leest. De client POST't shot-historie van een
  boon + de setup; de route stuurt dat naar het LLM en geeft een
  gestructureerd "next shot"-advies terug.
- De heuristische engine (`lib/tips.ts`) blijft bestaan als snelle, offline
  laag. Het LLM is de "verras me / diepere analyse"-laag eroverheen.

## Roadmap

### Fase 1 — Fundament ✅ (deze stap)
- Maalgraad → getal, migratie `0008`.
- `Setup`-type + `setup`-tabel + `/instellingen` UI.
- Numerieke maalgraad-stepper in de shot-form, begrensd door de setup-schaal.

### Fase 2 — Slimmere heuristiek (offline, gratis) ✅
- `beanSweetSpot()` leert per boon de tijd- en ratio-range uit de eigen
  ≥4★ shots; valt terug op de algemene vuistregels bij <3 goede shots.
  De time-/ratio-tips vergelijken nu daartegen i.p.v. vaste 25–32 s.
- Grind-drift is exact: "ga N stappen fijner/grover" op de maler-schaal.
- Anomalie-tip: laatste shot wijkt ≥8 s af van de mediaan van de boon.
- Feedback-loop: de shot-form toont het `nextAdjustment` van de vorige
  shot als reminder-banner. Of de aanpassing is uitgevoerd leidt de
  engine af uit de instellingen-delta (geen los ja/nee-veld nodig).

### Fase 3 — LLM-coach ✅
- Provider: **OpenAI**, model `gpt-4.1-mini` (override via env-var
  `OPENAI_MODEL`). Key staat als `OPENAI_API_KEY` in de Vercel env vars.
- `app/api/coach/route.ts` — Next.js API-route (Node runtime). Krijgt
  boon + setup + shot-historie, bouwt een NL-prompt, vraagt OpenAI om
  gestructureerd advies (json_schema, strict) en geeft dat terug. De
  maalgraad wordt geklemd binnen de maler-schaal.
- `components/CoachCard.tsx` — UI-kaart op de boon-detail (bij ≥2 shots).
  Knop "Analyseer mijn shots" → headline, recept (maalgraad/dose/yield/
  tijd), redenering-bullets, "let op" en een zekerheidsbadge.
- Advies-type gedeeld via `lib/coach.ts` (`ShotAdvice`).
- Toekomst: prompt caching, advies cachen per boon-hash, evt. naar
  een nieuwer model als dat er is.

## Openstaand
- Alle drie de fases staan. Mogelijke vervolgstappen: prompt caching,
  advies cachen per boon-hash, een nieuwer/goedkoper model, en de
  heuristiek verder verfijnen op basis van gebruik.
