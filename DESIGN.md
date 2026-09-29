# Red — Design Direction

**Expressive, playful, and legible.** A cycle tracker is used daily and often
while someone feels unwell. The previous direction was Material 3, quiet and
neutral. This one keeps the clarity but adds warmth, bigger type, real color,
and motion that responds to the user.

Replaces the Material 3 direction entirely. `antislop.md` is the filter on top.

**Dial: ENERGY 7 / RHYTHM 6 / MOTION 7 / DENSITY 4**

- ENERGY 7 (Bright): saturated phase colors used as full fields, not washes.
  The app should feel alive and personal, not clinical.
- RHYTHM 6 (Varied): cards share structure, but the hero, the calendar, and the
  stats each have their own composition. No repeated three-card rows.
- MOTION 7 (Responsive): spring-based enters, press feedback on every control,
  animated state changes. No parallax, no scroll hijacking, no celebration
  confetti on a health log.
- DENSITY 4 (Daily app): comfortable spacing, 44px targets, room to breathe.

## 1. Why this direction

The APK is the primary surface, but the design is not tied to a platform
component kit. It is a small, opinionated system built in plain CSS so the
whole app reads as one product: the calendar, the day sheet, the insights, and
the profile all speak the same visual language.

Hand-rolled is the deliberate choice here. A component kit would have made the
app look like every other Android app, which is exactly the problem this
direction fixes.

## 2. Colour

Warm rose-led palette on a soft blush ground. One accent family (rose), one
supporting green (fertile), and a small set of data colors. No blue, no purple.

The generator is `scripts/palette.mjs` and it **prints a contrast report**. A
palette change that breaks AA fails visibly rather than shipping.

### Roles

| Role | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#fff6f2` | `#1a1119` | Page ground |
| `--card` | `#ffffff` | `#261a26` | Cards, sheets, modals |
| `--ink` | `#2a1a2e` | `#fdf2f5` | Body and headings |
| `--ink-2` | `#4a3a4e` | `#e2cdd6` | Secondary text |
| `--muted` | `#6d5a70` | `#b09aa8` | Captions, labels |
| `--line` | `#f0dcd8` | `#3a2a38` | Borders, dividers |
| `--period` | `#d81b47` | `#ff6b8a` | Bleeding, primary action |
| `--period-ink` | `#b3133a` | `#ff8ba3` | Rose text on soft tints |
| `--rose-soft` | `#fbe8ed` | `#3d2432` | Selected chips, tints |
| `--fertile` | `#12855a` | `#4fd39a` | Fertile window |
| `--ovulation` | `#0d6b47` | `#3ec48c` | Ovulation peak |
| `--pms` | `#b0461c` | `#ffa06b` | Premenstrual |
| `--amber-line` | `#8a3d12` | `#e08b5c` | Warning text |
| `--indigo` | `#4a4ab8` | `#8f8fe8` | Pill dose marker |
| `--heart` | `#b02f6f` | `#e878b0` | Sex log marker |

### Verified

Every text-on-surface pair below passes WCAG AA. The generator prints the
report; `test/design-tokens.test.ts` recomputes it from the live values.

| Pair | Light | Dark |
|---|---|---|
| ink on bg | 15.3 | 16.9 |
| ink on card | 16.3 | 15.3 |
| muted on bg | 5.9 | 7.1 |
| muted on card | 6.3 | 6.4 |
| period on card | 5.0 | 6.1 |
| fertile on card | 4.6 | 8.8 |
| amber-line on amber | 6.8 | - |
| period-ink on rose-soft | 5.8 | 4.6 |

### Phase colours are data

The cycle phases keep distinct hues because the same colour marks the same
phase on the calendar, the day sheet, and the badge. They are checked as text
against the card, not the page, because that is where they are used.

## 3. Typography

One family, system stack, wide weight range. `ui-sans-serif, system-ui,
Roboto`. On Android that is Roboto, which has a real 500 and 700.

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| Display | 40px | 700 | 1.05 | -0.03em |
| Headline | 26px | 700 | 1.2 | -0.02em |
| Title | 18px | 600 | 1.3 | -0.01em |
| Body | 15px | 400 | 1.55 | normal |
| Label | 13px | 600 | 1.4 | 0.01em |
| Caption | 12px | 500 | 1.4 | 0.02em |

Three weights: 400, 500, 600, and 700 for display only. Hierarchy comes from
size, weight, and color together.

**Numbers are tabular.** Every stat, countdown, and calendar day uses
`font-variant-numeric: tabular-nums`, so values do not jitter when they change.

## 4. Shape

One scale, applied by role. No one-off radii.

| Token | Value | Role |
|---|---|---|
| `--r-sm` | 6px | Chips, small badges |
| `--r` | 10px | Inputs, small buttons |
| `--r-md` | 14px | Buttons, list items |
| `--r-lg` | 20px | Cards |
| `--r-xl` | 28px | Sheets, modals |
| `--r-full` | 9999px | Pills, avatars, icon buttons |

## 5. Elevation

Tinted shadows, not black. The shadow carries the rose hue, so a raised card
feels part of the same world rather than cut out of it.

| Level | Treatment | Use |
|---|---|---|
| 0 | none | Page, inline groups |
| 1 | `0 1px 2px rgba(90,20,45,.05)` | Cards at rest |
| 2 | `0 6px 20px rgba(90,20,45,.10)` | Floating nav, popovers |
| 3 | `0 -8px 30px rgba(90,20,45,.18)` | Bottom sheet, modal |

Cards still use a border as the primary containment. The shadow is a second,
quieter cue, never the only one.

## 6. Components

### Navigation

**Five tabs: Beranda, Kalender, Wawasan, Riwayat, Profil.** A floating pill,
detached from the screen edge, so content shows through behind it.

- Profil replaces the old Pengaturan tab. Settings lives behind a button at the
  bottom of the profile screen, where account actions belong.
- The active tab is a filled rose pill with the icon and label in the accent.

### Buttons

| Variant | Treatment | Use |
|---|---|---|
| `primary` | Rose fill, white text | One per screen |
| default | Soft tint fill, ink text | Secondary actions |
| `on` | Rose fill, white text | Selected toggle |
| `ghost` | Transparent, muted text | Dismiss, cancel |
| `danger` | Rose-soft fill, rose-ink text | Destructive |

All 44px minimum height. Press feedback is a `scale(.96)` on `:active`.

### Cards

One radius, one border, one quiet shadow. A card is a grouping device, not
decoration. Use it when content needs a boundary, not by default.

### Sheets and modals

Bottom sheets slide up with a spring, modals pop in with a scale. Both use
`--r-xl` top corners and the level-3 shadow.

## 7. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| Short | 140ms | `cubic-bezier(.2,.8,.2,1)` | State change, press |
| Medium | 240ms | `cubic-bezier(.22,1,.36,1)` | Enter, reveal |
| Long | 380ms | `cubic-bezier(.34,1.4,.64,1)` | Sheet, modal, nav |

Rules:

- Animate only `transform` and `opacity`. Never `top`, `left`, `width`, `height`.
- Every animation states a purpose: feedback, state change, or hierarchy.
- Stagger card and list enters with a small cascade so content arrives in order.
- `prefers-reduced-motion: reduce` collapses all of it to instant.

## 8. Rules

**Do**
- Use tokens by name. If a colour is missing, add the token, not a raw hex.
- Use the rose family for anything interactive.
- Use tabular numbers for every stat.
- Give every control a visible pressed state.
- Check contrast from real values before shipping a palette change.

**Don't**
- Put raw hex in a component. Two escaped today (`#c9333a`, `#fff`); both move
  into tokens.
- Use a pure black shadow.
- Add a sixth bottom-nav tab.
- Use blue or purple as an accent.
- Animate anything on a timer the user did not trigger, except the loading state.
- Ship one theme and assume the other works.

## 9. Verification

- `node scripts/palette.mjs` prints the contrast report; 0 failures required.
- `test/design-tokens.test.ts` computes contrast from the live token values in
  both light and dark.
- `test/class-coverage.test.ts` proves every class used in a component exists in
  the stylesheet.
- Both themes are checked. Shipping one broken mode is a defect.

## 10. Migration note

The M3 role names (`--md-*`) and the old token set are replaced. The token
names here (`--bg`, `--card`, `--ink`, `--period`, `--rose`, ...) are the ones
the components already use, so the swap is a value change, not a rewrite.
