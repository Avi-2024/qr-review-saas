# QR Review SaaS

A clean full-stack Next.js prototype for QR/NFC-powered customer feedback and Google review handoff.

## Customer flow

QR landing → rating → neutral contextual topics → optional note → backend review generation → edit/regenerate → copy → direct Google review composer.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Versioned Next.js Route Handler API
- Zod request validation
- Repository/service architecture
- In-memory repository for zero-setup partner demos
- PostgreSQL adapter for production persistence
- Server-side generation rate limiting
- Analytics events for session, generation, copy and Google-open actions

## Run the partner demo

No database or API key is required.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The default `.env.example` uses `REVIEW_REPOSITORY=memory`, so the full frontend → backend flow runs without external infrastructure.

## Run with PostgreSQL

Create `.env.local`:

```env
REVIEW_REPOSITORY=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/qr_review
REVIEW_RATE_LIMIT_MAX=12
REVIEW_RATE_LIMIT_WINDOW_MS=600000
```

Then run:

```bash
npm run db:migrate
npm run dev
```

The migration seeds Mangal Traders, its neutral review topics and its direct Google review URL.

## API

- `GET /api/health`
- `GET /api/v1/public/locations/:publicId`
- `POST /api/v1/public/sessions`
- `POST /api/v1/public/reviews/generate`
- `POST /api/v1/public/reviews/:reviewId/events`

## Architecture

Backend code is deliberately separated by responsibility:

```text
app/api/                     HTTP routes only
server/domain/               domain types
server/application/ports/    interfaces/contracts
server/application/services/ business use cases
server/infrastructure/       database, generators, rate limiting
server/http/                 validation + HTTP helpers
server/bootstrap/            dependency composition
```

See [`docs/backend.md`](docs/backend.md) for details.

## Review generation

The partner demo uses a local server-side generator so it remains free and reliable. The generator is behind a `ReviewGenerator` interface, allowing an OpenAI/Gemini implementation to be added later without changing the API routes or application service.

## Google handoff

The current demo targets Mangal Traders using its Google Place ID and direct `writereview` URL. Generated text is copied to the clipboard; the customer remains responsible for pasting/editing and posting the review on Google.

## Production next steps

- Redis-backed distributed rate limiting
- Merchant authentication and RBAC
- Multi-tenant organization/location management
- Merchant dashboard and funnel analytics
- AI provider adapter with cost/latency controls
- Background event pipeline / queue
- Structured logs and error monitoring
