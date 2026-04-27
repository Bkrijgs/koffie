# Koffie — Sage Barista Express dial-in log

Een mobielvriendelijke Next.js app om espresso-shots te loggen per boon. Bedoeld als
dial-in dagboek voor de Sage Barista Express: bewaar maalgraad, dose, yield,
brew ratio, doorlooptijd, smaaknotities en je volgende aanpassing — en zie
welke instellingen de beste shots opleverden.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Lokale opslag via `localStorage` (zie `lib/storage.ts`)
- Klaar om uitgerold te worden naar Vercel

## Aan de slag

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Data persistence

De MVP slaat alle data op in `localStorage` onder de keys
`koffie:beans:v1` en `koffie:shots:v1`. De storage-laag is geabstraheerd
achter de `KoffieStorage` interface in `lib/storage.ts`, zodat je hem later
kunt vervangen door bijvoorbeeld Supabase of Vercel Postgres zonder de UI
aan te raken.

## Deploy

Push naar GitHub en importeer het project in Vercel. Geen extra
omgevingsvariabelen nodig voor de MVP.

## Datamodel

Zie `lib/types.ts` voor `Bean` en `ShotLog`. `brewRatio` wordt automatisch
afgeleid uit `yieldGrams / doseGrams` bij het opslaan van een shot.
