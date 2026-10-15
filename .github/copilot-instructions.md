# Shopwise UI instructions

## What this repo is

Shopwise is a WhatsApp ordering, inventory and profit tracker for informal vendors, mainly in Nigeria. The repo contains `shopwise-backend` (FastAPI) and `shopwise-dashboard` (Next.js). Data lives in Supabase.

## Scope guard

- UI work happens only in `shopwise-dashboard` or the marketing app when specifically requested. Never touch `shopwise-backend`, migrations, env files or Supabase policies.
- Change the smallest responsible component first. Do not add dependencies or npm packages unless approved.
- On working pages, change only the visual layer. Keep every data call, hook, prop, route and type.
- Work on one section or page per request. Do not change neighbouring pages.
- Work on branch `feature/ui-premium`. Never commit to `main`.

## Content rules

- Use real data only. Do not invent numbers, customers, testimonials, logos, prices, plans, ratings or deltas.
- If a value has no data source, show an honest empty state such as "No sales yet".
- Do not use em dashes in copy or comments.
- Use short, active, plain Nigerian-friendly English without jargon.
- Buttons say exactly what happens. Toasts use the same verb in the past tense.
- Order states: `awaiting_confirmation`, `pending_payment`, `confirmed`, `canceled`.
- Payment states: `pending`, `paid`, `failed`, `cancelled`, `refunded`. Only `payments.status = 'paid'` means paid.

## Palette

Use only these colors. Replace emerald or green utilities with these tokens. Do not use raw hex values in components.

| Token | Hex | Use |
|---|---|---|
| `cream` | `#F7F3EE` | Page background |
| `paper` | `#FCFAF7` | Cards, inputs and popovers |
| `sand` | `#DDD0C8` | Borders, tinted tiles and selected rows |
| `sand-soft` | `#EAE1DA` | Hairlines, table dividers and skeletons |
| `ink` | `#323232` | Primary text and dark panels |
| `ink-soft` | `#6B635D` | Secondary text on cream or paper |
| `brand` | `#1DB954` | Primary fills, active marker, paid dot and lead chart series |
| `brand-hover` | `#1ED760` | Hover and pressed brand fills |
| `on-brand` | `#323232` | Text and icons on brand |
| `warn` | `#B7791F` | Pending states |
| `danger` | `#B3402F` | Failed, canceled and destructive states |

- Text on brand is always `on-brand`. Never use brand as text on cream or paper.
- On ink panels, body text is cream and secondary text is cream at 70% opacity.
- Green is rare: one primary action per view, active nav marker, paid indicators and the lead chart series.
- Shadows use ink, never pure black.

## Type and layout

- Headings and long text use Source Serif 4. UI uses Inter.
- Type scale: h1 56/60 desktop and 40/44 mobile; h2 40/44 and 30/36; h3 24/30; body 16/26; small 14/22; caption 12/18.
- Money and counts use tabular numerals.
- Keep body copy under 75 characters per line.
- Do not use all-caps tracked labels, eyebrows above headings, numbered markers outside sequences, or a single accented word inside a headline.
- Page shell: max width 1152px and 24px side padding. Section spacing: 64px mobile and 96px desktop.
- Inputs and chips use `rounded-lg`, buttons `rounded-xl`, cards `rounded-2xl`, and hero panels and closing CTAs `rounded-3xl`.
- Use `shadow-card` and `shadow-lift` only. Avoid shadows on tables and list rows.
- Do not turn every element into an identical bordered card.
- Use the existing icon library with 1.8 stroke. Never use emoji as icons.

## Motion

- Motion confirms a user action. Do not animate section reveals or lift every card on hover.
- Spring easing: `cubic-bezier(0.34, 1.56, 0.64, 1)`. Entrances and glides: `cubic-bezier(0.16, 1, 0.3, 1)`. Toasts: `cubic-bezier(0.18, 1.25, 0.4, 1)`.
- Respect `prefers-reduced-motion` for every animation.

## Quality floor

- Check 390px, 768px and 1280px with no horizontal scroll.
- Every interactive element has a visible 2px focus ring with 2px offset, ink on light surfaces and cream on dark panels.
- Body text contrast is at least 4.5:1.
- Fetched data has loading, empty and error states.
- Run `npm run build` and the linter. Resolve console warnings and errors.
- Do not leave dead links, unused imports or reference code.
- Summarize in three lines: kept, changed and untouched. List any value without a source.

## Process

1. Read these instructions. Inspect the repo and state framework, router and styling method in three lines before coding.
2. For reference-driven work, preserve the reference structure and behavior. Restyle using these tokens and real Shopwise copy.
3. For dashboard pages, change only visual styling and preserve all data calls, hooks and props.
4. After one section or page, run its checklist and stop for the next request.

## Shopwise UI playbook

### How to use this playbook
1. Keep this file at `.github/copilot-instructions.md`.
2. For a reference-driven task, open one source page below and copy its code.
3. Send the prompt for the requested section, followed by the reference code.
4. Check the result in the browser before moving to another section.

Prompt-only work is estimated to be about 60% accurate; reference code plus the prompt is estimated at 85–90%.

### Part A: Marketing site

Build one item at a time, in this order:
1. Foundation: tokens, fonts, page shell
2. Nav
3. Hero
4. Stats strip
5. Features (bento)
6. Before and after
7. Pricing
8. FAQ
9. Closing CTA
10. Footer
11. Motion polish

Reference sources (Vibeprompts):
- Nav: https://vibeprompts.dev/nav/nav-sticky-top-nav/
- Hero: https://vibeprompts.dev/hero/hero-split-hero-with-screenshot/
- Stats: https://vibeprompts.dev/stats/stats-four-metric-row/
- Features: https://vibeprompts.dev/features/features-bento-grid/
- Before and after: https://vibeprompts.dev/features/features-before-and-after-split/
- Pricing: https://vibeprompts.dev/pricing/pricing-three-tier-with-highlight/
- FAQ: https://vibeprompts.dev/faq/faq-accordion-list/
- Closing CTA: https://vibeprompts.dev/cta/cta-full-width-dark-banner/
- Footer: https://vibeprompts.dev/footer/footer-multi-column-footer/

#### Foundation prompt (send first, alone)
Read `.github/copilot-instructions.md`. Inspect the repo and state framework, router type and styling method in three lines.

Create only the foundation for the marketing landing page and dashboard:
1. Add the palette above as CSS variables and wire it into Tailwind v4 so `bg-cream`, `text-ink`, `bg-brand`, `text-on-brand`, `border-sand`, `shadow-card` and `shadow-lift` work.
2. Load Source Serif 4 and Inter with Next.js `next/font/google`, using `display: 'swap'`.
3. Keep the page shell at max width 1152px with 24px side padding.
4. Keep an empty Section wrapper with 64px vertical spacing on mobile and 96px on desktop.
5. Set a global 2px ink focus-visible outline with 2px offset. Use cream for focus inside `.on-dark`.
6. Preserve existing styles and dashboard page behavior. Identify existing emerald utilities and `surface-emerald` references by file path for gradual migration.

Do not build any new section. Do not change any dashboard page or touch `shopwise-backend`.

#### Prompt template for each marketing section
Read `.github/copilot-instructions.md`.

Build the [SECTION NAME] section of the landing page as one component in its own file.
Keep the structure and behaviour of the reference code below. Restyle it to our tokens.
Shopwise copy: [WRITE 2 TO 3 LINES OF REAL COPY HERE].
Do not edit any other file except where the section is mounted.
When done, give me the 3-line summary (kept, changed, untouched).

REFERENCE CODE:
[PASTE CODE]

#### Suggested copy
- Hero headline: “Your WhatsApp orders, sorted. Your profit, clear.”
- Hero sub: “Customers order on WhatsApp. Shopwise logs the sale, updates stock and shows what you really earned.”
- Stats: “Orders logged automatically”, “Stock updated per sale”, “Profit per item”, “Weekly summary in plain English”
- Before and after — before: “Orders buried in chats. Stock counted by memory. Profit is a guess.”
- Before and after — after: “Every order in one list. Stock moves by itself. Profit shown per item.”

### Part B: Dashboard polish

The dashboard already exists. Change only the visual layer; preserve every data call, hook, prop, and existing behavior. Work on one page or section per request, and do not touch `shopwise-backend`.

Map existing pages/components to these references:
- Overview: https://vibeprompts.dev/dashboards/dashboards-sidebar-stat-cards/
- Orders: https://vibeprompts.dev/dashboards/dashboards-data-table-with-toolbar/
- Profit chart: https://vibeprompts.dev/dashboards/dashboards-chart-card-with-legend/
- Inbox: https://vibeprompts.dev/dashboards/dashboards-inbox-split-view/
- Replenishment: https://vibeprompts.dev/dashboards/dashboards-inventory-replenishment-cockpit/
- Activity: https://vibeprompts.dev/dashboards/dashboards-activity-feed-panel/

For dashboard page requests, add: “This page already works. Change only the visual layer. Keep every data call, hook and prop.”

Motion reference: Kinetics (https://kinetics.colorion.co/). Use sparingly for action confirmation only, and respect reduced-motion preferences:
- Toast overshoot for “Order confirmed”
- Quantity stepper for stock edits
- Number counter for profit totals
- Status pill for order state
- Skeleton-to-content transition for loading
