# Backend architecture

The backend uses a layered architecture so HTTP, business rules, persistence, analytics and review generation remain independent.

## Layers

- `app/api/` — thin Next.js Route Handlers. Parse HTTP input and return HTTP output only.
- `server/application/` — use cases and ports. Business workflows live here.
- `server/domain/` — domain types with no framework dependencies.
- `server/infrastructure/` — PostgreSQL, memory repository, rate limiting and review generator implementations.
- `server/http/` — request helpers, Zod schemas and standard API responses.
- `server/bootstrap/` — dependency composition.
- `database/migrations/` — ordered, tracked PostgreSQL migrations.

## Public review identity

The customer entry point is a QR token, not a location slug.

Example:

```text
/r/mangal-counter-demo
```

The token resolves to a QR asset and then to its location. This lets one location have multiple measurable QR assets such as counter, billing, entrance or packaging QR codes.

## Session lifecycle

A scan creates an expiring session using a client-generated UUID.

```text
QR token + clientSessionId
  -> idempotent review session
  -> QR_SCANNED event once
```

Retries with the same `(qr_code_id, client_session_id)` return the existing session instead of creating duplicate scans.

Default TTL is 60 minutes and is configurable with `REVIEW_SESSION_TTL_MINUTES`.

## Generation idempotency

Every generation action sends a `requestId` UUID. PostgreSQL claims `(session_id, request_id)` before generation. A retry returns the already-completed draft, while concurrent duplicates receive a conflict response. Processing claims older than two minutes can be reclaimed after a crashed worker.

The draft, selected topics, generation analytics event and claim completion are saved in one transaction.

## Analytics events

Current event taxonomy:

- `QR_SCANNED`
- `RATING_SELECTED`
- `TOPIC_SELECTED`
- `GENERATE_CLICKED`
- `REVIEW_GENERATED`
- `REVIEW_REGENERATED`
- `REVIEW_EDITED`
- `REVIEW_COPIED`
- `GOOGLE_REVIEW_OPENED`

Client analytics writes include an idempotent `eventId`. Google-navigation analytics use `sendBeacon`/`keepalive` so navigation does not cancel the event request.

## Review generation rules

Topic chips are neutral context only. Selecting `Pricing` or `Staff Interaction` does not cause the generator to invent claims such as “pricing was reasonable” or “staff were polite.”

The rating controls only the overall sentiment. Any optional customer note is preserved and must not be contradicted by future AI providers.

The Google review option is available regardless of rating.

## Runtime modes

### Local partner demo

```env
REVIEW_REPOSITORY=memory
IP_HASH_SECRET=development-only-change-me
```

No database is required.

### Production

Production fails fast unless durable storage and IP hashing are configured:

```env
NODE_ENV=production
REVIEW_REPOSITORY=postgres
DATABASE_URL=postgresql://...
IP_HASH_SECRET=<at-least-32-random-characters>
```

Run:

```bash
npm run db:migrate
```

## Public API

- `GET /api/health`
- `GET /api/v1/public/qr/:token`
- `GET /api/v1/public/locations/:publicId` — compatibility endpoint
- `POST /api/v1/public/sessions`
- `POST /api/v1/public/sessions/:sessionId/events`
- `POST /api/v1/public/reviews/generate`
- `POST /api/v1/public/reviews/:reviewId/events`

## Security and abuse controls

- Zod validates all public request bodies.
- Public generation/session/event endpoints have separate rate-limit buckets.
- Stored IP identifiers use HMAC-SHA256 rather than an unsalted plain hash.
- Memory rate limiter periodically removes expired keys.
- Production requires PostgreSQL; memory persistence is intentionally demo-only.

For horizontal production scaling, replace the in-memory limiter with a shared Redis/Upstash implementation behind the same rate-limit boundary.

## CI quality gate

Pull requests and `main` pushes run:

1. PostgreSQL 16 service startup
2. all tracked migrations against a real database
3. TypeScript typecheck
4. regression tests
5. Next.js production build

Merchant authentication and dashboards should be built on top of this hardened foundation rather than bypassing these contracts.
