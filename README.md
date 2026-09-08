# mediTicket

Book a hospital appointment: pick a service (cost & duration come from an API, not hardcoded), choose a date/time, enter your details, and pay with Stripe Checkout.

## Stack

- Next.js (App Router, TypeScript) — frontend + API routes
- Prisma + SQLite — appointment persistence
- Stripe Checkout — payment
- Controller/service split: `app/api/*` routes are controllers, `lib/*` holds business logic

## Setup

```bash
npm install
cp .env.example .env
# fill in STRIPE_SECRET_KEY (test mode) in .env
npm run db:push
npm run dev
```

In a second terminal, forward Stripe webhooks to your local server and copy the printed `whsec_...` into `.env` as `STRIPE_WEBHOOK_SECRET`:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

Open http://localhost:3000, book a service, and pay with a Stripe test card (`4242 4242 4242 4242`, any future expiry, any CVC).

## Docker

```bash
cp .env.example .env   # fill in STRIPE_SECRET_KEY first
docker compose up -d --build
```

Serves on http://localhost:3000. The SQLite file lives in a named volume (`mediticket_data`), so appointments persist across `docker compose down`/`up`. Secrets are read from `.env` at container *runtime* only — they are never baked into the image (`.env` is dockerignored).

## How it works

1. `GET /api/services` — serves services from `data/services.json` (cost in cents, duration in minutes).
2. `POST /api/checkout` — re-validates the service and price server-side, then atomically creates a `pending` `Appointment` row and creates a Stripe Checkout Session, returning its URL.
   - **Double-booking guard:** `Appointment` has a unique constraint on `(serviceId, date, time)`. If two people try to book the same slot at once, the database rejects the second `create` and the API returns `409` before a second Stripe session is ever created — this (not any kind of ID encryption) is what guarantees only one paid transaction per slot.
3. Stripe redirects the browser to `/success` or `/cancel`.
4. `POST /api/webhook` — verifies the Stripe signature and flips the appointment to `paid` on `checkout.session.completed`. This is the source of truth for payment status, not the redirect.

## Left undone (practice scope)

- No auth/patient accounts — anyone can book.
- An abandoned checkout (browser closed before paying) still permanently holds its slot — no expiry/cleanup job for stale `pending` rows.
- No email confirmation sending (webhook only updates status).
- Docker image installs full `node_modules` (incl. dev deps) rather than a slim multi-stage/standalone build — simpler, but a larger image than a production-tuned one.
