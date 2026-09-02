# Backend architecture

The backend uses a layered architecture so HTTP, business rules, persistence, analytics and review generation remain independent.

## Layers

- `app/api/` — thin Next.js Route Handlers. Parse HTTP input and return HTTP output only.
- `server/application/` — use cases and ports. Business workflows live here.
- `server/domain/` — domain types with no framework dependencies.
- `server/infrastructure/` — PostgreSQL, memory repository, distributed/local rate limiting and review generator implementations.
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
RATE_LIMIT_BACKEND=memory
```

No database or Redis service is required.

### Production

Production fails fast unless durable storage, IP hashing and shared rate limiting are configured:

```env
NODE_ENV=production
REVIEW_REPOSITORY=postgres
DATABASE_URL=postgresql://...
IP_HASH_SECRET=<at-least-32-random-characters>
RATE_LIMIT_BACKEND=upstash
RATE_LIMIT_KEY_PREFIX=qr-review
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=<server-side-rest-token>
```

Run:

```bash
npm ci
npm run db:migrate
npm run build
```

`package-lock.json` is committed and CI uses `npm ci`, so dependency resolution is reproducible across validation and deployments.

## Distributed rate limiting

Production rate limits are shared through the Upstash Redis REST API. Each request uses one atomic Redis `EVAL` operation that increments the bucket and applies its TTL in the same command.

The Redis key does not contain the raw client IP or raw request identifier. The identifier is HMAC-SHA256 hashed locally using `IP_HASH_SECRET` before it is sent to Redis.

If Upstash is temporarily unavailable, the limiter falls back to the existing bounded in-process limiter so the customer flow does not become fully unavailable. This fallback is per-instance and is intended only as outage protection, not as the normal production limiter.

Current buckets remain separate for:

- merchant sign-in attempts
- customer review sessions
- review generation
- review/session analytics events

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
- Production rate-limit counters are shared across app instances through Redis/Upstash.
- Redis rate-limit identifiers are HMAC-hashed before leaving the application.
- Stored IP identifiers use HMAC-SHA256 rather than an unsalted plain hash.
- Local fallback rate limiting periodically removes expired keys.
- Production requires PostgreSQL and Upstash; memory persistence/rate limiting is intentionally local/demo-only.

## CI quality gate

Pull requests and `main` pushes run:

1. PostgreSQL 16 service startup
2. locked dependency installation with `npm ci`
3. all tracked migrations against a real database
4. TypeScript typecheck
5. regression tests, including distributed limiter behavior
6. Next.js production build

Merchant authentication and dashboards should be built on top of this hardened foundation rather than bypassing these contracts.
