# Red — Design Direction

**Editorial, spacious, refined rose.** A cycle tracker is opened daily, often
when someone feels unwell or worried. It should read like a calm, well-set
magazine page: one clear idea per screen, generous space, confident type, and
colour that carries meaning rather than decoration.

Replaces the Material 3 direction and the short-lived expressive pass.

**Dial: VARIANCE 9 / MOTION 7 / DENSITY 3**

- VARIANCE 9 (Asymmetric): nothing sits in a symmetrical three-box row. The
  home screen is a full-bleed statement; the calendar is a quiet grid; the
  insights screen is a vertical editorial column of oversized figures.
- MOTION 7 (Responsive): spring easing, staggered reveals, press feedback on
  every control. No parallax, no scroll hijacking, no confetti.
- DENSITY 3 (Spacious): 24–32px section gaps, large type, plenty of air. Not a
  cockpit. This is a journal, not a dashboard.

## 1. Why this direction

The app is used in short, quiet moments: logging a period, checking a date,
reading why a prediction says what it says. Dense card grids fight that. The
editorial layout gives each fact room and lets the important number be large.

**Honest note on scope.** `design-taste-frontend` is written for landing pages
and portfolios, and its own rules say it does not apply to product UI or native
mobile. Only its transferable parts are used here: colour calibration, type
discipline, motion guardrails, and the anti-slop checks. The landing-page
patterns (hero stacks, logo walls, bento grids) do not apply and are not used.

## 2. Colour

Warm paper ground, deep rose accent, plum-black ink. One accent family (rose),
one supporting green (fertile), and a small set of data colours.

### Roles

| Role | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#fdf8f6` | `#160c11` | Page ground |
| `--card` | `#ffffff` | `#221319` | Cards, sheets, modals |
| `--ink` | `#241018` | `#fdf4f6` | Body and headings |
| `--ink-2` | `#4a2f3a` | `#e6d0d7` | Secondary text |
| `--muted` | `#7d6068` | `#b39aa2` | Captions, labels |
| `--line` | `#f0e0e0` | `#382028` | Borders, dividers |
| `--period` | `#c8103f` | `#ff5c82` | Bleeding, primary action |
| `--period-ink` | `#a50d34` | `#ff8ba3` | Rose text on soft tints |
| `--rose-soft` | `#fce8ec` | `#3a1f28` | Selected chips, tints |
| `--fertile` | `#0f7a52` | `#48cc93` | Fertile window |
| `--ovulation` | `#0b5f40` | `#3bbd88` | Ovulation peak |
| `--pms` | `#a8410f` | `#ff9a63` | Premenstrual |
| `--amber` | `#fbe9dd` | `#3a2318` | Warning surface |
| `--amber-line` | `#7d3808` | `#e59062` | Warning text |
| `--indigo` | `#3f3fa8` | `#a0a0f0` | Pill dose marker |
| `--heart` | `#a3245f` | `#f07ab0` | Sex log marker |

### Verified

Every text-on-surface pair passes WCAG AA. `scripts/palette.mjs` prints the
report from these exact values; `test/design-tokens.test.ts` recomputes it from
the stylesheet, so a drift fails CI rather than shipping.

| Pair | Light | Dark |
|---|---|---|
| ink on bg / card | 17.2 / 18.1 | 17.8 / 16.6 |
| ink-2 on bg / card | 11.3 / 11.9 | 13.1 / 12.2 |
| muted on bg / card | 5.3 / 5.6 | 7.4 / 6.9 |
| period on card | 5.8 | 6.1 |
| fertile on card | 5.4 | 8.8 |
| period-ink on rose-soft | 6.6 | 6.7 |
| amber-line on amber | 7.3 | 5.9 |

White on `--period` is 5.8:1, so a filled rose button is safe in both modes.

### Phase colours are data

The cycle phases keep distinct hues: the same colour marks the same phase on
the calendar, the day sheet, and the badge. They are checked as text against the
card, which is where they are used.

## 3. Typography

One family, system stack: `ui-sans-serif, system-ui, Roboto`.

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| Display | 56px | 700 | 1.0 | -0.035em |
| Headline | 30px | 700 | 1.15 | -0.03em |
| Title | 19px | 600 | 1.3 | -0.015em |
| Body | 16px | 400 | 1.6 | normal |
| Label | 13px | 600 | 1.4 | 0.02em |
| Eyebrow | 11px | 700 | 1.4 | 0.14em, uppercase |
| Caption | 12px | 500 | 1.45 | 0.01em |

Four weights: 400, 500, 600, 700. Hierarchy comes from size, weight, and colour.

**Numbers are tabular.** Every stat, countdown, and calendar day sets
`font-variant-numeric: tabular-nums` so values do not jitter as they change.

**Eyebrows are rationed.** The small uppercase label above a section is used at
most once per three sections. Most sections lead with the heading alone.

## 4. Space

An 8px base unit. Section gaps are large; this is the main lever that makes the
layout read as editorial rather than as a dashboard.

| Token | Value | Use |
|---|---|---|
| `--s-1` | 4px | Tight pairs |
| `--s-2` | 8px | Inner gaps |
| `--s-3` | 12px | Row gaps |
| `--s-4` | 16px | Page gutter |
| `--s-5` | 24px | Card padding |
| `--s-6` | 32px | Section gap |
| `--s-7` | 48px | Screen break |
| `--s-8` | 64px | Statement block |

## 5. Shape

One scale, applied by role.

| Token | Value | Role |
|---|---|---|
| `--r-sm` | 8px | Chips, badges |
| `--r` | 12px | Inputs, small buttons |
| `--r-md` | 16px | Buttons, list rows |
| `--r-lg` | 22px | Cards |
| `--r-xl` | 32px | Sheets, modals |
| `--r-full` | 9999px | Pills, avatars |

## 6. Elevation

Tinted shadows carrying the rose hue, never black in light mode.

| Level | Light | Use |
|---|---|---|
| 1 | `0 1px 2px rgba(80,12,36,.04)` | Cards at rest |
| 2 | `0 8px 24px rgba(80,12,36,.08)` | Floating nav |
| 3 | `0 -10px 40px rgba(80,12,36,.16)` | Sheet, modal |

A card always keeps its border. The shadow is a second, quieter cue.

## 7. Layout families

Each screen has its own composition. No two screens share a layout family.

| Screen | Family |
|---|---|
| Beranda | Full-bleed phase statement, then stacked blocks |
| Kalender | Quiet grid, month nav as a caption line |
| Wawasan | Vertical editorial column of oversized figures |
| Riwayat | Dated list with a leading rule |
| Profil | Identity banner, then a stat row |
| Pengaturan | Sectioned rows with hairline dividers, no cards |
| Auth / Onboarding | Centred single column, one idea per step |

## 8. Components

### Navigation

Five tabs: Beranda, Kalender, Wawasan, Riwayat, Profil. A floating pill,
detached from the edge. The active tab is a filled rose pill.

### Buttons

| Variant | Treatment | Use |
|---|---|---|
| `primary` | Rose fill, white text | One per screen |
| default | Soft tint, ink text | Secondary |
| `on` | Rose fill, white text | Selected toggle |
| `ghost` | Transparent, muted text | Dismiss |
| `danger` | Rose-soft fill, `--period-ink` text | Destructive |

44px minimum height. Press feedback is `scale(.97)`.

### Cards

One radius, one border, one quiet shadow. Cards group content; they are not the
default wrapper. Settings uses rows and hairlines instead of cards.

### Sheets and modals

Sheets slide up on a spring, modals pop on a scale. Both use `--r-xl` top
corners and the level-3 shadow.

## 9. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| Short | 140ms | `cubic-bezier(.2,.8,.2,1)` | State change, press |
| Medium | 260ms | `cubic-bezier(.22,1,.36,1)` | Enter, reveal |
| Long | 420ms | `cubic-bezier(.34,1.3,.64,1)` | Sheet, modal, nav |

Rules:

- Animate only `transform` and `opacity`.
- Every animation states a purpose: feedback, state change, or hierarchy.
- Stagger list and card enters with a small cascade.
- `prefers-reduced-motion: reduce` collapses all of it to instant.

## 10. Rules

**Do**
- Use tokens by name. A missing colour means adding a token, not a raw hex.
- Use rose for anything interactive.
- Use tabular numbers for every figure.
- Give every control a visible pressed state.
- Check contrast from real values before shipping a palette change.

**Don't**
- Put raw hex in a component.
- Use a pure black shadow in light mode.
- Add a sixth bottom-nav tab.
- Use blue or purple as an accent.
- Use a card where a hairline divider would do.
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
so components keep working; the values are new. Space and type tokens are added.
The old cream palette and the Material 3 role names are gone.
