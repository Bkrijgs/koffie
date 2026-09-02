# Koffie — Sage Barista Express dial-in log

Een mobielvriendelijke Next.js app om espresso-shots te loggen per boon. Bedoeld als
dial-in dagboek voor de Sage Barista Express: bewaar maalgraad, dose, yield,
brew ratio, doorlooptijd, smaaknotities en je volgende aanpassing — en zie
welke instellingen de beste shots opleverden.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres) als data store, met `localStorage`-fallback
- Klaar om uitgerold te worden naar Vercel

## Aan de slag

```bash
npm install
cp .env.example .env.local   # vul Supabase URL + anon key in
npm run dev
```

Open <http://localhost:3000>.

## Database in Supabase opzetten

1. **Project aanmaken** — ga naar <https://supabase.com>, klik *New project*,
   kies een naam (bijv. `koffie`) en een region (bv. `eu-central-1`).
2. **Schema uitvoeren** — open *SQL Editor* → *New query*, plak de inhoud
   van [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   en klik *Run*. Dit maakt de tabellen `beans` en `shots` aan, plus indexen
   en RLS-policies.
3. **API-keys kopiëren** — ga naar *Project Settings* → *API* en kopieer:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Lokaal** — zet beide waarden in `.env.local` en herstart `npm run dev`.
5. **Vercel** — voeg dezelfde variabelen toe in *Project Settings* →
   *Environment Variables* en redeploy.
6. **Verifieer** — voeg een boon en een shot toe via de UI; ze verschijnen
   in *Table Editor* → `beans` / `shots`.

> Zonder env-vars valt de app automatisch terug op `localStorage`, zodat
> previews ook werken zonder Supabase-config.

Draaide je het schema eerder al? Voer dan ook de latere migraties in
`supabase/migrations/` op volgorde uit (ze zijn idempotent). Voor
concept-shots is `0013_draft_shots.sql` nodig: die voegt de `draft`-kolom toe
en staat `rating = 0` toe voor concept- en dial-in shots. Voor
onderhoudskosten op `/kosten` is `0014_expenses.sql` nodig: die maakt de
`expenses`-tabel en zet en passant de ontbrekende delete-policy op `shots`.

## Data persistence

De storage-laag zit achter de `KoffieStorage` interface in
[`lib/storage.ts`](lib/storage.ts). `supabaseBackend` praat met Postgres via
`@supabase/supabase-js`; `localStorageBackend` is de fallback. De keuze
gebeurt op basis van `isSupabaseConfigured` in `lib/supabase.ts`.

## Espresso Compass

De knop linksonder opent de *Espresso Compass* van
[BaristaHustle](https://baristahustle.com) als pop-up: een naslagkaart die
smaak uitzet tegen extractie en sterkte. Bewust een overlay en geen aparte
pagina — je hebt hem nodig terwijl je een shot logt, en wegnavigeren vanuit
`/shots/new` zou het half ingevulde formulier weggooien. Tik op de plaat om
in te zoomen op het punt dat je aanraakt; Escape, de terugknop of een tik
ernaast sluit hem weer.

De plaat staat in `public/kompas/espresso-compass.webp` (2048 px breed,
±240 kB). Opnieuw maken vanaf de bron-PDF:

```bash
pip install pillow pymupdf
python3 scripts/make-kompas-asset.py ~/Downloads/EspressoCompass.pdf
```

In e-ink modus (`?eink=1`) blijft de knop verborgen: dat apparaat heeft geen
werkende aanraking.

## Deploy

Push naar GitHub, importeer in Vercel en zet de twee
`NEXT_PUBLIC_SUPABASE_*` variabelen in *Environment Variables*.

## Datamodel

Zie `lib/types.ts` voor `Bean` en `ShotLog`. `brewRatio` wordt automatisch
afgeleid uit `yieldGrams / doseGrams` bij het opslaan van een shot.
