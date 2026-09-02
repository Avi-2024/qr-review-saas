# QR Review SaaS

Full-stack Next.js SaaS for QR/NFC-powered customer feedback, Google review handoff and merchant reputation analytics.

## Customer flow

QR scan → rating → neutral contextual topics → optional note → backend review generation → edit/regenerate → copy → direct Google review composer.

## Merchant platform

The merchant workspace now includes:

- database-backed merchant authentication
- owner/admin/manager/viewer roles
- organization-scoped sessions and queries
- overview dashboard
- location management
- QR touchpoint creation and activation
- scannable SVG QR preview/download
- scan → review draft → Google-open analytics

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- PostgreSQL production persistence
- Zod request validation
- service/repository architecture
- bcrypt password hashing
- opaque database-backed auth sessions
- HttpOnly/Secure/SameSite cookies
- QR SVG generation
- Vitest unit + PostgreSQL integration tests

## Run customer demo only

```bash
npm install
cp .env.example .env.local
npm run dev
```

The default `.env.example` uses `REVIEW_REPOSITORY=memory`, so the customer review demo at `/` runs without PostgreSQL.

## Run full merchant platform

Create PostgreSQL and configure `.env.local`:

```env
REVIEW_REPOSITORY=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/qr_review
IP_HASH_SECRET=replace-with-a-long-random-secret
AUTH_COOKIE_NAME=qr_merchant_session
AUTH_SESSION_TTL_HOURS=168
AUTH_LOGIN_RATE_LIMIT_MAX=10

MERCHANT_ADMIN_EMAIL=owner@example.com
MERCHANT_ADMIN_PASSWORD=replace-with-a-strong-password
MERCHANT_ADMIN_NAME=Owner Name
MERCHANT_ORGANIZATION_NAME=Mangal Traders
```

Then:

```bash
npm install
npm run db:migrate
npm run merchant:create-admin
npm run dev
```

Open:

- customer demo: `http://localhost:3000`
- merchant login: `http://localhost:3000/login`
- merchant dashboard: `http://localhost:3000/dashboard`

No merchant password is hardcoded in the repository. The bootstrap script hashes the password with bcrypt and creates/updates the owner membership.

## Public customer API

- `GET /api/health`
- `GET /api/v1/public/qr/:token`
- `POST /api/v1/public/sessions`
- `POST /api/v1/public/sessions/:sessionId/events`
- `POST /api/v1/public/reviews/generate`
- `POST /api/v1/public/reviews/:reviewId/events`

## Merchant API

- `POST /api/v1/merchant/auth/login`
- `POST /api/v1/merchant/auth/logout`
- `GET /api/v1/merchant/auth/me`
- `GET /api/v1/merchant/dashboard`
- `GET|POST /api/v1/merchant/locations`
- `PATCH /api/v1/merchant/locations/:locationId`
- `GET|POST /api/v1/merchant/qr-codes`
- `PATCH /api/v1/merchant/qr-codes/:qrCodeId`
- `GET /api/v1/merchant/qr-codes/:qrCodeId/svg`

## Architecture

```text
app/api/                         thin HTTP routes
server/domain/                  customer review domain
server/application/             customer review use cases
server/merchant/domain/         merchant domain
server/merchant/application/    merchant use cases + repository port
server/merchant/infrastructure/ PostgreSQL merchant adapter
server/auth/                    session/cookie/token helpers
server/infrastructure/          shared DB/rate-limit adapters
database/migrations/            ordered tracked migrations
```

## Important product rules

- Google review option is available regardless of rating.
- Generated text must preserve customer sentiment and must not invent specific facts from topic selections.
- `GOOGLE_REVIEW_OPENED` means the Google composer was opened; it is not labeled as a posted review.
- New locations automatically receive neutral review topics.

## Remaining production scale work

- Redis/Upstash distributed rate limiting
- organization switching for users who belong to multiple organizations
- password reset / email verification / MFA
- structured logging and monitoring
- AI provider adapter with cost/latency fallback
