# QR Review SaaS Demo

Premium Next.js partner demo for a QR/NFC-powered customer review experience.

## Demo flow

QR landing → rating → contextual chips → optional note → review generation → edit/regenerate → copy → direct Google review composer.

## Tech

- Next.js 16 App Router
- React 19
- TypeScript
- Custom responsive CSS
- No API key required for the demo generation flow

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Google review handoff

The demo currently targets the Mangal Traders direct Google review composer using its Place ID.

## Production path

Replace the local review generator in `lib/review.ts` with a backend AI endpoint and load merchant/location configuration dynamically from the SaaS backend.
