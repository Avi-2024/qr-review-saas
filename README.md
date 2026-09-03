# QR Review SaaS

Full-stack Next.js SaaS for QR/NFC-powered customer feedback, Google review handoff and merchant reputation analytics.

The product core is **sector agnostic**. The same QR, session, review-generation and analytics engine is designed for restaurants, cafes, hotels, clinics, dental practices, salons, gyms, retail, education, automotive, real estate, professional services, home services, entertainment venues and other customer-facing businesses without requiring a sector-specific code fork.

## Customer flow

QR scan → rating → neutral contextual topics → optional note → backend review generation → edit/regenerate → copy → direct Google review composer.

## Sector-agnostic model

- Organizations and locations are generic business entities, not restaurant/store-specific models.
- Every location gets universal neutral topics by default: Overall Quality, Staff / Support, Value / Pricing, Ease / Convenience, Environment / Cleanliness and Speed / Timeliness.
- QR touchpoint types are free-form. A merchant can use values such as reception, table, room, checkout, vehicle, appointment-desk, classroom, service-area, delivery, booth, packaging or any future touchpoint without a code change.
- Generated review language does not assume a physical store visit.
- Customer branding is derived from the configured business/location rather than a hardcoded merchant identity.
- Sector presets are an onboarding convenience only; the core data model remains generic and configurable.

## Merchant platform

The merchant workspace includes:

- database-backed merchant authentication
- owner/admin/manager/viewer roles
- organization-scoped sessions and queries
- resumable five-step merchant onboarding
- Google Maps business search for selecting the correct review destination
- manual Google Place ID fallback when Places search is unavailable
- overview dashboard
- location management
- per-location review topic management with add/edit/reorder/archive/restore
- sector-aware suggested topic presets without sector-locking the data model
- QR touchpoint creation and activation
- scannable SVG QR preview/download
- organization funnel analytics
- per-QR placement analytics for scans, generated drafts, Google opens and measured conversion

## QR performance analytics

The Analytics workspace ranks every physical QR touchpoint while preserving historical performance for paused QR assets.

Metrics are session-cohort based so they stay consistent with the main review funnel:

```text
QR scanned
→ review generated
→ Google review composer opened
```

Per QR the dashboard shows:

- scans
- generated review drafts
- Google review composer opens
- scan → generated rate
- scan → Google rate
- generated → Google rate
- active/paused status
- location and free-form touchpoint type/reference

Merchants can filter the QR breakdown by location and by 7/30/90-day windows. Zero-activity QR assets remain visible, and best-conversion ranking requires a minimum scan sample so a one-scan QR does not become a misleading winner. `GOOGLE_REVIEW_OPENED` is never presented as a posted Google review.

## Review topic management

After onboarding, merchants can manage the neutral topic prompts shown in the customer QR experience at `/dashboard/topics`.

Rules:

- topics are configured per location
- 3–8 topics can be active at one time
- customers can select up to 3 active topics
- labels and icons are editable
- active topic order controls customer-display order
- removed topics are archived rather than deleted, preserving historical review references
- archived topics can be restored with the same stable topic ID
- suggested sector presets can be re-applied at any time
- viewer-role merchants have read-only access

## Google business search

Merchant onboarding and Location Management use **Places API (New)** rather than asking merchants to find a `ChIJ...` identifier manually.

Flow:

```text
Business name + city
→ Autocomplete (New)
→ merchant selects exact branch
→ Place Details (New) verifies the selection
→ selected Place ID is stored
→ direct Google review composer URL is generated
```

Implementation rules:

- the Google API key remains server-side only
- autocomplete calls use a UUID session token
- the same token is passed to Place Details when the merchant selects a place
- autocomplete responses are `no-store`
- returned Google names/addresses are displayed only for selection verification; QR Review persists the Place ID, not copied Google Places content
- search is merchant-authenticated and rate limited
- a manual Place ID fallback remains available for resilience

Enable **Places API (New)** in Google Cloud and configure:

```env
GOOGLE_PLACES_API_KEY=replace-with-your-google-maps-platform-api-key
GOOGLE_PLACES_REQUEST_TIMEOUT_MS=4000
GOOGLE_PLACES_RATE_LIMIT_MAX=80
```

Restrict the API key to the required Google Maps Platform API in Google Cloud. Do not expose this key through `NEXT_PUBLIC_*` variables.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- PostgreSQL production persistence
- Zod request validation
- service/repository architecture
- bcrypt password hashing
- opaque database-backed auth sessions
- HttpOnly/Secure/SameSite cookies
- Google Places API (New) server-side adapter
- QR SVG generation
- Upstash/Redis distributed production rate limiting with bounded local fallback
- Vitest unit + PostgreSQL integration tests

## Run customer demo only

```bash
npm ci
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

GOOGLE_PLACES_API_KEY=replace-with-your-google-maps-platform-api-key
GOOGLE_PLACES_REQUEST_TIMEOUT_MS=4000
GOOGLE_PLACES_RATE_LIMIT_MAX=80

MERCHANT_ADMIN_EMAIL=owner@example.com
MERCHANT_ADMIN_PASSWORD=replace-with-a-strong-password
MERCHANT_ADMIN_NAME=Owner Name
MERCHANT_ORGANIZATION_NAME=Your Business
```

For horizontally scaled production deployments also configure:

```env
RATE_LIMIT_BACKEND=upstash
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=replace-with-your-token
```

Then:

```bash
npm ci
npm run db:migrate
npm run merchant:create-admin
npm run dev
```

Open:

- customer demo: `http://localhost:3000`
- merchant login: `http://localhost:3000/login`
- merchant onboarding: `http://localhost:3000/onboarding`
- merchant dashboard: `http://localhost:3000/dashboard`
- review topics: `http://localhost:3000/dashboard/topics`
- analytics + QR performance: `http://localhost:3000/dashboard/analytics`

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
- `GET /api/v1/merchant/onboarding`
- `PATCH /api/v1/merchant/onboarding/business`
- `POST /api/v1/merchant/onboarding/location`
- `PUT /api/v1/merchant/onboarding/topics`
- `POST /api/v1/merchant/onboarding/qr`
- `POST /api/v1/merchant/onboarding/complete`
- `POST /api/v1/merchant/google-places/autocomplete`
- `POST /api/v1/merchant/google-places/details`
- `GET|POST /api/v1/merchant/locations`
- `PATCH /api/v1/merchant/locations/:locationId`
- `GET|PUT /api/v1/merchant/locations/:locationId/topics`
- `GET|POST /api/v1/merchant/qr-codes`
- `PATCH /api/v1/merchant/qr-codes/:qrCodeId`
- `GET /api/v1/merchant/qr-codes/:qrCodeId/svg`

## Architecture

```text
app/api/                         thin HTTP routes
server/domain/                  customer review domain
server/application/             customer review use cases
server/analytics/               isolated QR performance analytics domain/service/repository
server/merchant/domain/         merchant domain
server/merchant/application/    merchant use cases + repository port
server/merchant/topics/         isolated topic management service + repository
server/merchant/infrastructure/ PostgreSQL merchant adapter
server/integrations/            external provider adapters such as Google Places
server/auth/                    session/cookie/token helpers
server/infrastructure/          shared DB/rate-limit adapters
database/migrations/            ordered tracked migrations
```

## Important product rules

- Google review option is available regardless of rating.
- Generated text must preserve customer sentiment and must not invent specific facts from topic selections.
- `GOOGLE_REVIEW_OPENED` means the Google composer was opened; it is not labeled as a posted review.
- New locations automatically receive sector-neutral review topics.
- Archived topics are retained for historical integrity instead of being hard-deleted.
- Paused QR assets keep their historical analytics and remain visible in QR performance reports.
- Sector-specific wording belongs in configurable merchant content/presets, not in core business logic.
- Google Places content is not used as a long-lived business-content database; the Place ID is the persistent review-destination identifier.

## Remaining production scale work

- organization switching for users who belong to multiple organizations
- password reset / email verification / MFA
- structured logging and monitoring
- AI provider adapter with cost/latency fallback
- billing/subscriptions
- team member invitation and role management
