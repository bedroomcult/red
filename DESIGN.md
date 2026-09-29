# Red — Design Direction

**Flo-inspired: soft, rounded, friendly, ring-led.** Flo is the reference the
user actually likes. This direction borrows its structure and feel, not its
assets: a soft white-pink ground, generous rounded cards, tinted fills instead
of hard borders, pastel-to-saturated phase colours, and a large circular cycle
ring as the anchor of the home screen.

Replaces the Material 3, expressive-rose, and editorial directions.

**Dial: VARIANCE 5 / MOTION 5 / DENSITY 4**

- VARIANCE 5 (Comfortable): one ring, stacked rounded cards, no symmetry games.
  Friendly and legible rather than artsy.
- MOTION 5 (Soft): the ring arc draws in, cards rise with a short stagger,
  controls press with a gentle scale. Nothing bounces, nothing loops forever.
- DENSITY 4 (Daily app): comfortable spacing, 44px targets, cards carry the
  grouping.

## 1. What is borrowed, and what is not

Borrowed from Flo, at the structural level:

- A large circular cycle ring as the primary home element.
- Soft rounded cards with tinted fills; borders are quiet, not the containment.
- A light pink-tinted ground with white cards.
- Saturated phase colour used as a fill and as an arc, pastel as a background.
- Calm, plain, sentence-case copy with a friendly second person.

**Not borrowed, and deliberately so:**

- No Flo logo, wordmark, illustration art, icon set, or copy. The mark stays
  the existing droplet; icons stay the existing inline set.
- No illustration assets. This project has no image-generation tool available,
  and hand-rolled decorative SVG is a documented anti-pattern. The friendly
  feel comes from the ring, the shapes, and the palette instead. If real
  illustrations are wanted later, they slot into the ring and the empty states.
- No subscription, upsell, or content-marketing patterns from the Flo product.

## 2. Colour

Soft pink ground, white cards, rose accent. The accent is one family; green
marks the fertile window, amber marks warnings.

### Roles

| Role | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#fff7f9` | `#191016` | Page ground |
| `--card` | `#ffffff` | `#241820` | Cards, sheets, modals |
| `--ink` | `#2b1a22` | `#fdf3f6` | Body and headings |
| `--ink-2` | `#5a3d4a` | `#e4cdd7` | Secondary text |
| `--muted` | `#83636f` | `#ad919d` | Captions, labels |
| `--line` | `#f7e3ea` | `#3a2531` | Borders, dividers |
| `--period` | `#d91a52` | `#ff6b93` | Bleeding, primary action |
| `--period-ink` | `#b81446` | `#ff9ab4` | Rose text on soft tints |
| `--rose-soft` | `#ffe4ec` | `#3d1f2c` | Selected chips, tints |
| `--fertile` | `#0a7a57` | `#4ed4a0` | Fertile window |
| `--ovulation` | `#086a4b` | `#40c394` | Ovulation peak |
| `--pms` | `#ab4d0c` | `#ffa266` | Premenstrual |
| `--amber` | `#fdecd8` | `#3a2517` | Warning surface |
| `--amber-line` | `#803806` | `#f0a06e` | Warning text |
| `--indigo` | `#4a4ab8` | `#a0a0f0` | Pill dose marker |
| `--heart` | `#b02f6f` | `#f07ab0` | Sex log marker |

### Verified

Every text-on-surface pair passes WCAG AA. `scripts/palette.mjs` prints the
report from these exact values; `test/design-tokens.test.ts` recomputes it from
the stylesheet, so a drift fails CI.

| Pair | Light | Dark |
|---|---|---|
| ink on bg / card | 15.6 / 16.5 | 17.2 / 15.8 |
| ink-2 on bg / card | 9.1 / 9.5 | 12.4 / 11.4 |
| muted on bg / card | 5.0 / 5.3 | 6.5 / 6.0 |
| period on card | 5.0 | 6.3 |
| fertile on card | 5.3 | 9.2 |
| period-ink on rose-soft | 5.4 | 7.4 |
| amber-line on amber | 7.3 | 6.8 |

White on `--period` is 5.0:1, so a filled rose button is safe in both modes.

### Phase colours are data

The cycle phases keep distinct hues: the same colour marks the same phase on
the ring, the calendar, the day sheet, and the badge.

## 3. Typography

One family, system stack: `ui-sans-serif, system-ui, Roboto`. Rounded-friendly
rather than editorial: no oversized display type, no all-caps eyebrows.

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| Ring figure | 48px | 700 | 1.0 | -0.03em |
| Headline | 26px | 700 | 1.2 | -0.02em |
| Title | 18px | 600 | 1.35 | -0.01em |
| Body | 16px | 400 | 1.55 | normal |
| Label | 13px | 600 | 1.4 | 0.01em |
| Caption | 12px | 500 | 1.45 | normal |

Weights: 400, 500, 600, 700. Sentence case everywhere. No uppercase labels.

**Numbers are tabular** wherever they change (ring figure, stats, calendar).

## 4. Space

An 8px base, comfortable spacing.

| Token | Value | Use |
|---|---|---|
| `--s-1` | 4px | Tight pairs |
| `--s-2` | 8px | Inner gaps |
| `--s-3` | 12px | Row gaps |
| `--s-4` | 16px | Page gutter |
| `--s-5` | 24px | Card padding |
| `--s-6` | 32px | Section gap |
| `--s-7` | 48px | Screen break |

## 5. Shape

Rounded throughout. Flo's feel comes mostly from the radius and the tinted
fills, so this scale is generous.

| Token | Value | Role |
|---|---|---|
| `--r-sm` | 10px | Chips, badges |
| `--r` | 14px | Inputs, small buttons |
| `--r-md` | 18px | Buttons, list rows |
| `--r-lg` | 24px | Cards |
| `--r-xl` | 32px | Sheets, modals |
| `--r-full` | 9999px | Pills, avatars, ring |

## 6. Elevation

Soft, low, rose-tinted. Flo cards float lightly rather than sit in a frame.

| Level | Light | Use |
|---|---|---|
| 1 | `0 2px 8px rgba(140,30,70,.05)` | Cards at rest |
| 2 | `0 8px 24px rgba(140,30,70,.09)` | Floating nav |
| 3 | `0 -10px 40px rgba(140,30,70,.16)` | Sheet, modal |

Cards keep a hairline border as well, so they hold shape on the pink ground.

## 7. The cycle ring

The ring is the home screen's anchor and the direction's signature element.

- One SVG circle, `stroke-linecap: round`, drawn as a progress arc.
- The arc length is the current cycle day over the cycle length, so the ring
  fills as the cycle advances.
- The arc colour is the phase colour. The track is `--rose-soft`.
- The centre carries the headline figure (cycle day) and a short label.
- Phase is also written as plain text beside the ring, so the ring is never the
  only carrier of meaning (colour-blind and screen-reader safety).
- Reduced motion: the arc renders at its final value with no draw animation.

## 8. Components

### Navigation

Five tabs: Beranda, Kalender, Wawasan, Riwayat, Profil. A floating white pill
with a soft shadow. The active tab is a filled rose pill.

### Buttons

| Variant | Treatment | Use |
|---|---|---|
| `primary` | Rose fill, white text | One per screen |
| default | `--rose-soft` fill, `--period-ink` text | Secondary |
| `on` | Rose fill, white text | Selected toggle |
| `ghost` | Transparent, muted text | Dismiss |
| `danger` | `--rose-soft` fill, `--period-ink` text | Destructive |

44px minimum height. Press feedback is `scale(.96)`.

### Cards

Rounded, white, soft shadow, hairline border. Cards group content; they are the
default wrapper for a block of related information.

### Sheets and modals

Sheets slide up, modals pop in. Both use `--r-xl` top corners and the level-3
shadow.

## 9. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| Short | 140ms | `cubic-bezier(.2,.8,.2,1)` | State change, press |
| Medium | 260ms | `cubic-bezier(.22,1,.36,1)` | Enter, ring draw |
| Long | 420ms | `cubic-bezier(.34,1.3,.64,1)` | Sheet, modal, nav |

Rules:

- Animate only `transform` and `opacity`.
- Every animation states a purpose: feedback, state change, or hierarchy.
- `prefers-reduced-motion: reduce` collapses all of it to instant.

## 10. Rules

**Do**
- Use tokens by name. A missing colour means adding a token, not a raw hex.
- Use rose for anything interactive.
- Use the ring for cycle position, and always restate it as text.
- Use tabular numbers for every figure.
- Give every control a visible pressed state.

**Don't**
- Copy Flo's logo, art, icons, or copy.
- Hand-roll decorative SVG illustrations.
- Put raw hex in a component.
- Use uppercase eyebrow labels.
- Use a pure black shadow in light mode.
- Ship one theme and assume the other works.

## 11. Verification

- `node scripts/palette.mjs` prints the contrast report; 0 failures required.
- `test/design-tokens.test.ts` computes contrast from the live token values in
  both themes.
- `test/class-coverage.test.ts` proves every class used in a component exists in
  the stylesheet.
- Both themes are checked. Shipping one broken mode is a defect.

## 12. Migration note

Token names (`--bg`, `--card`, `--ink`, `--period`, `--rose`, ...) are unchanged
so components keep working; the values are new. The space scale carries over.
The editorial layout families (hairline rows, oversized stat columns) are
replaced by rounded cards, and the home screen gains the ring.
