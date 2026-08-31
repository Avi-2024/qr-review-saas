# Backend architecture

The backend follows a small layered architecture so HTTP, business rules, persistence and review generation stay independent.

## Layers

- `app/api/` — thin Next.js Route Handlers. Parse HTTP input and return HTTP output only.
- `server/application/` — use cases and ports. Business workflows live here.
- `server/domain/` — domain types with no framework dependencies.
- `server/infrastructure/` — PostgreSQL, memory repository, rate limiter and review generator implementations.
- `server/http/` — request parsing, Zod schemas and standard API responses.
- `server/bootstrap/` — dependency composition.

## Runtime modes

### Demo

No database is needed. Keep `REVIEW_REPOSITORY=memory` or omit `DATABASE_URL`.

### PostgreSQL

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env.local`.
3. Set `REVIEW_REPOSITORY=postgres` and `DATABASE_URL`.
4. Run `npm run db:migrate`.

## Public API

- `GET /api/health`
- `GET /api/v1/public/locations/:publicId`
- `POST /api/v1/public/sessions`
- `POST /api/v1/public/reviews/generate`
- `POST /api/v1/public/reviews/:reviewId/events`

The Google review option is never hidden based on rating. The generated text remains editable by the customer before they continue to Google.

## Scale path

The in-memory limiter is intentionally small and dependency-free for the demo. Replace it with Redis/Upstash before horizontal scaling. The review generator is behind a port, so an OpenAI/Gemini implementation can be added without changing route handlers or application services.
