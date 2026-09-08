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

## Chat widget

A floating assistant, backed by an LLM calling the MCP tools (`buscar_horarios`, `listar_informacion`, `agendar_cita`, `link_pago`). It extends the existing tokens rather than introducing a new "third-party widget" look — no new brand color, no drop-in chat-plugin styling.

**Bubble (closed state).** Fixed `bottom-4 right-4` (`sm:bottom-6 sm:right-6`), a 56px circle, `bg-brand` with a white chat-line SVG icon (no emoji, per §6) and `shadow-lg` for elevation above page content — the rest of the app uses `shadow-sm` on inline cards, but a floating control needs to read as detached from the page, not just embossed on it. Becomes an "×" close icon while the panel is open.

**Panel.**
- Base (< 640px): near-full-screen sheet — `fixed inset-x-0 bottom-0 top-14`, so the page peeks above it like a native bottom sheet. `rounded-t-2xl`.
- `sm:` (≥ 640px): fixed floating panel, `w-96 h-[32rem]`, anchored `bottom-20 right-6`, `rounded-2xl shadow-lg`, `border border-gray-200` (matches the card border weight used elsewhere).
- Structure: header (`bg-brand text-white`, title "Asistente mediTicket" + close button) — message list (`flex-1 overflow-y-auto`) — input row pinned to the bottom.

**Messages.**
- User: right-aligned, `bg-brand text-white`, `rounded-lg`, max-width ~80%.
- Assistant: left-aligned, `bg-teal-50 text-gray-900`, `rounded-lg` — a light tint pulled from the same hue as `brand` (Tailwind's `teal-700`), not a new color.
- Tool-driven content gets its own treatment so it reads as *data*, not prose:
  - Available slots (`buscar_horarios`): a wrapped row of pill buttons — `rounded-lg border border-brand text-brand text-sm px-3 py-1.5`, hover fills `bg-brand/5`. Tapping one fills the input with a booking request for that slot rather than making the user retype it.
  - Payment link (`link_pago`): rendered as a full-width button styled exactly like the booking form's submit button (`rounded-lg bg-brand py-3 font-semibold text-white hover:bg-brand-dark`) with label "Pagar ahora" — the same visual verb as "Reserve & Pay", so it reads as the same kind of action.

**Input row.** Text input (`rounded-lg border border-gray-300 px-3 py-2`, matching the booking form's fields exactly) + a circular `bg-brand` send button, disabled with `opacity-50` while a response is streaming.

**Unavailable state.** When the chat backend has no `ANTHROPIC_API_KEY` configured, the bubble still opens (hiding it would look like a bug), but the panel shows the header plus a centered notice — no input row — stating plainly: "El asistente no está disponible en este momento." No apology, no vague wording, matching the interface's existing error voice (`text-gray-500`, `text-sm`).

## Known gaps

- No dark-mode tokens defined — the app currently assumes light mode only (`color-scheme: light` is hardcoded in `globals.css`).
- No iOS/Android-specific treatment — this is a web-only surface today.
