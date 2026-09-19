# Red — Design Direction

**Material 3**, the platform design system for the Android app this ships as.

Replaces the earlier Lovable-derived direction, which was a landing-page system
(spacing 80–208px, editorial display type) applied to a phone app. Wrong tool.

Source of truth for direction. `antislop.md` is the filter on top.

**Dial: ENERGY 2 / RHYTHM 2 / MOTION 2 / DENSITY 5**

- ENERGY 2 (Calm): a health tool. It should feel quiet and dependable, not
  energetic. No celebration animations on a cycle tracker.
- RHYTHM 2 (Consistent, a few breaks): cards share one structure. The home hero
  varies by cycle phase, which is the one deliberate break.
- MOTION 2 (Transitions and a few reveals): M3 motion easing, state changes
  animated so the UI feels responsive. No parallax, no choreography.
- DENSITY 5 (Daily app): standard app spacing. Not a marketing page, not a
  cockpit.

## 1. Why Material 3 and not a web system

The APK is the primary surface. Material 3 is what Android users already know:
the touch feedback, the bottom sheet, the nav bar, the tonal surfaces. Using a
web aesthetic on Android makes the app feel foreign on its own platform.

This also means **Material 3 components, not hand-rolled lookalikes**, wherever
one exists. A bottom sheet is a bottom sheet.

## 2. Colour

Derived from a single seed (`#c0392f`, the period colour) using the M3 tonal
palette method: six palettes, tones on the CIE L* scale, roles assigned by tone.

The generator is `scripts/m3-palette.mjs` and it **prints a contrast report**. A
palette change that breaks AA fails visibly rather than shipping.

### Roles

| Role | Light | Dark | Used for |
|---|---|---|---|
| `primary` | `#a44e44` | (tone 80) | Primary action, selected state |
| `on-primary` | `#fff6f0` | | Text on primary |
| `primary-container` | `#ffc7b9` | | Selected chip, filled button hover |
| `on-primary-container` | `#3b0000` | | Text on container |
| `secondary` | `#82635f` | | Less prominent actions |
| `tertiary` | `#7e6935` | | Contrasting accent |
| `error` | (tone 40) | | Destructive, missed dose |
| `surface` | (neutral 98) | (neutral 6) | Page background |
| `surface-container` | (neutral 94) | (neutral 12) | Cards |
| `on-surface` | (neutral 10) | (neutral 90) | Body text |
| `on-surface-variant` | (neutralVariant 30) | (neutralVariant 80) | Captions, labels |
| `outline` | (neutralVariant 50) | (neutralVariant 60) | Borders |
| `outline-variant` | (neutralVariant 80) | (neutralVariant 30) | Dividers |

### Verified

30 of 30 specified text-on-surface pairs pass WCAG AA in both modes. The report
is printed by the generator, not asserted by hand.

### Phase colours stay, as data

The six cycle phases keep their own hues. They are not part of the M3 palette
because they are **data**, not chrome: the same colour marks the same phase on
the calendar, the day sheet, and the badge. They are re-toned to sit on M3
surfaces and each is contrast-checked against `surface-container`.

## 3. Typography

Material 3 type scale, system font. `ui-sans-serif, system-ui, Roboto` on
Android, which is what the platform renders natively.

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| Headline (hero) | 26px | 600 | 1.25 | -0.02em |
| Title large | 20px | 600 | 1.3 | normal |
| Title medium | 16px | 600 | 1.4 | normal |
| Body large | 16px | 400 | 1.5 | normal |
| Body medium | 14px | 400 | 1.5 | normal |
| Label large | 14px | 600 | 1.4 | 0.01em |
| Label medium | 12px | 600 | 1.4 | 0.02em |
| Display stat | 44px | 600 | 1.0 | -0.03em |

Two weights only: 400 and 600. Hierarchy comes from size and colour.

## 4. Shape

M3 shape scale. One system, applied by role, not by feel.

| Token | Value | Role |
|---|---|---|
| `--md-shape-xs` | 4px | Chips, small badges |
| `--md-shape-sm` | 8px | Inputs, small buttons |
| `--md-shape-md` | 12px | Buttons, list items |
| `--md-shape-lg` | 16px | Cards |
| `--md-shape-xl` | 28px | Bottom sheets |
| `--md-shape-full` | 9999px | FAB, nav pill, icon buttons |

## 5. Elevation

M3 uses **surface tint and level**, not drop shadows. A raised surface is a
lighter tone of `surface-container`, not a shadow.

| Level | Treatment | Use |
|---|---|---|
| 0 | `surface` | Page |
| 1 | `surface-container-low` | Cards at rest |
| 2 | `surface-container` | Cards, menus |
| 3 | `surface-container-high` | Bottom sheet, nav bar |
| 4 | `surface-container-highest` | Dialogs |

Shadow appears only on the bottom sheet and the nav bar, where the element
genuinely floats above scrolling content.

## 6. Components

### Navigation

**Restructured.** A 5-tab bottom bar is the Android default and it was hiding the
app's real structure: Riwayat is a view of the same data as Wawasan, and
Pengaturan is not a peer of Beranda.

| Before | After |
|---|---|
| Beranda, Kalender, Wawasan, Riwayat, Pengaturan | **Beranda, Kalender, Wawasan** + top-bar avatar for account |

- **Bottom nav: 3 destinations.** M3 supports 3–5; 3 is the honest count.
- **Riwayat moves into Wawasan** as a second section. Same data, one place.
- **Pengaturan moves behind the top-bar avatar**, where account actions belong.
  This is where Android users look for settings.

### Buttons

M3 variants, used by hierarchy:

- **Filled** (`primary`) — one per screen, the primary action.
- **Tonal** (`secondary-container`) — secondary actions.
- **Outlined** (`outline` border) — tertiary.
- **Text** (`primary` text) — inline, lowest emphasis.

All 40px minimum height, `full` radius only for icon buttons and chips.

### Sheets

Bottom sheets use `shape-xl` top corners, `surface-container-high`, and a
visible drag handle. This is the M3 modal bottom sheet, not a custom panel.

### State layers

M3 state layers: hover 8%, focus 12%, pressed 12% of `on-surface`. Replaces
opacity changes, so the feedback is consistent across every control.

## 7. Motion

M3 motion tokens:

| Token | Duration | Easing | Use |
|---|---|---|---|
| Short | 150ms | emphasized-decelerate | State change |
| Medium | 250ms | emphasized-decelerate | Enter |
| Long | 400ms | emphasized | Sheet, nav |

Every animation must have a stated purpose (feedback, state transition,
hierarchy). `prefers-reduced-motion` collapses all of them.

## 8. Rules

**Do**
- Use M3 roles by name, never raw hex in a component.
- Use tone-based surfaces for elevation, not shadows.
- Use one filled button per screen.
- Keep the 3-tab nav; account lives in the top bar.
- Use M3 state layers for interaction feedback.

**Don't**
- Hand-roll a component Material 3 already defines.
- Add a fourth bottom-nav tab.
- Use a drop shadow for a card.
- Mix this with the old Lovable tokens. It replaces them.
- Put raw hex in a component. If a colour is missing from the token set, add the
  token, not the hex.

## 9. Verification

- The palette generator prints a contrast report; 0 failures required.
- `test/design-tokens.test.ts` computes contrast from the real token values.
- Both themes are checked. Shipping one broken mode is a defect.

## 10. Migration note

The old tokens (`--bg`, `--ink`, `--muted`, `--rose`, `--green`, `--radius`) are
**removed**, not aliased. Keeping both would leave two systems in the tree and
the next change would pick whichever it found first.
