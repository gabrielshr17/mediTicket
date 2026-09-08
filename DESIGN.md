# DESIGN.md — mediTicket

Written after the fact to document the design system already in use, since this was skipped during initial build. Kept as the source of truth going forward — any new screen should pull from these tokens rather than inventing new ones.

## Colors

| Token | Hex | Use |
|---|---|---|
| `brand` | `#0f766e` | Primary actions (Reserve & Pay button), selected-service border/ring |
| `brand-dark` | `#0b5750` | Primary button hover state |
| Background | `#f4f6f8` | Page background (`body`) |
| Surface | `#ffffff` | Cards (service tiles, form container, confirmation panel) |
| Text | `#111827` | Default body text |
| Muted text | Tailwind `gray-500` | Descriptions, secondary labels |
| Error | Tailwind `red-600` | Validation errors, cancel-page heading |

## Typography & spacing

- Font: system default (no custom font loaded).
- Spacing: Tailwind's default scale (base-4, i.e. 0.25rem increments) — not strictly base-8, but consistent throughout via Tailwind utilities (`p-4`, `p-6`, `gap-3`, `space-y-8`).
- Radius: `rounded-lg` (form inputs, buttons) / `rounded-xl` / `rounded-2xl` (cards, containers) — larger radius on larger surfaces.
- Type scale: Tailwind defaults — `text-2xl` (page titles), `text-lg` (section headers), `text-sm` (labels/meta), base for body copy.

## Breakpoints (mobile-first)

- Base (< 640px): single-column service list, stacked date/time and name/email inputs, full-width button. Touch targets: inputs/buttons use `py-2`/`py-3`, comfortably above 44px.
- `sm:` (≥ 640px): service cards and the date/time and name/email pairs switch to 2-column grids (`sm:grid-cols-2`).
- No further breakpoints defined yet — desktop just gets more breathing room via the `max-w-3xl`/`max-w-xl` container caps on `<main>`, not a distinct layout.

## Flow (small viewport first)

1. **Service** — radio-card grid, each showing name, description, price, duration.
2. **Date & time** — native `<input type="date">` / `<input type="time">`.
3. **Patient details** — name + email.
4. **Reserve & Pay** — full-width submit, disabled while redirecting, shows the live total from the selected service.
5. Redirect to Stripe Checkout (hosted) → `/success` or `/cancel`.

## Known gaps

- No dark-mode tokens defined — the app currently assumes light mode only (`color-scheme: light` is hardcoded in `globals.css`).
- No iOS/Android-specific treatment — this is a web-only surface today.
