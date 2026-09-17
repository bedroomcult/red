# Red — Design Direction

Adapted from the Lovable design system for a **mobile period tracker**, not a
landing page. The warmth and restraint carry over. The page-scale spacing, the
font, and the dark mode do not, and are replaced with values this product needs.

Source of truth for direction. `antislop.md` is the filter applied on top.

**Dial: ENERGY 2 / RHYTHM 2 / MOTION 2**

- ENERGY 2 (Balanced): warm and approachable, not shouty. A health tool should
  feel calm, not like a product launch.
- RHYTHM 2 (Consistent with a few breaks): cards share a structure; the home
  hero varies by cycle phase, which is the one deliberate break.
- MOTION 2 (Transitions and a few reveals): state changes are animated so the
  UI feels responsive. No parallax, no choreography.

## 1. What carries over from Lovable

- **Warm cream foundation** (`#f7f4ed`) instead of clinical white.
- **Opacity-driven neutrals**: grays derived from `#1c1c1c` at varying alpha, so
  every shade shares one hue.
- **Borders do the containment, not shadows.** `#eceae4` for passive divisions,
  `rgba(28,28,28,0.4)` for interactive boundaries.
- **Narrow weight range.** 400 for body and UI, 600 for headings. No 700+.
- **Editorial tracking at display sizes.** Negative letter-spacing that scales
  with size; normal tracking for body.
- **Radius scale**, not a long tail of one-off values.
- **Inset shadow on dark buttons** as the tactile signature.

## 2. What is adapted, and why

### 2.1 Font: system stack, not Camera Plain

Camera Plain Variable is not licensed or bundled here. Using it would mean
shipping a font file I cannot obtain.

**Decision:** keep the *principles*, not the face. A system stack renders
instantly, costs no download, and matches the platform's own text rendering,
which matters more on a phone than brand personality does.

```
font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```

The principles that survive: narrow weight range (400 / 600), tight negative
tracking at display sizes, generous line-height for body copy.

If you license a display face later, add it here and keep everything else.

### 2.2 Spacing: mobile scale

Lovable's 80px to 208px section rhythm is editorial whitespace for a scrolling
landing page. A 480px-wide phone app has no room for it and does not need it.

**Decision:** 8px base unit, and this scale only.

```
4, 8, 12, 16, 20, 24, 32
```

Section gaps are 16 to 24px, not 80+. Rhythm comes from the card border and the
hero, not from vast empty space.

### 2.3 Phase colours: kept, because they are data

Lovable says "don't introduce saturated accent colours". The six phase colours
(period rose, fertile green, ovulation green, pms amber, neutral grey, bc grey)
are **not decoration**. They encode which phase of the cycle the user is in, and
the same colours repeat on the calendar, the day sheet, and the phase badge. The
palette is doing a labelling job.

**Decision:** keep the phase colours. Their problem was never saturation, it was
**contrast**: white text over the lightest stop of the radial gave 1.45:1.

Fix, per section 4 below: the gradient becomes a **low-saturation atmospheric
wash** behind a solid text block, rather than a saturated field the text sits on.
That satisfies Lovable's "soft gradient wash, atmospheric, barely visible" note
and fixes the contrast failure at the same time.

### 2.4 Dark mode: derived, because DESIGN.md is silent

Lovable's direction is a single warm light theme. Red ships a theme toggle, and
R-34 requires both modes to work.

**Decision:** derive dark tokens from the same opacity model, inverted. Charcoal
`#1c1c1c` becomes the surface, cream becomes the text. Warmth is preserved by
keeping a warm-tinted dark (`#1a1917`) rather than a neutral black.

Dark mode is a first-class mode, not an afterthought: every token below has both
values and both are checked.

### 2.5 Focus: a visible ring, not a soft shadow

Lovable uses `rgba(0,0,0,0.1) 0px 4px 12px` as the focus indicator. A soft
shadow is not a reliable keyboard focus indicator, and R-32 requires a clearly
visible one.

**Decision:** keep the visible outline ring for keyboard focus, plus the soft
shadow as an additional active-state cue. Accessibility outranks the visual
preference here.

### 2.6 Radius: adopted, with the pill rule enforced

Lovable's scale is 4 / 6 / 8 / 12 / 16 / 9999. The app currently uses 14 distinct
values including `8px`, `9px`, `10px`, and `12px` doing the same job.

**Decision:** adopt the scale. `9999px` only for action pills, chips, and icon
buttons, never for rectangular buttons.

## 3. Colour Tokens

### Light

| Token | Value | Role |
|---|---|---|
| `--bg` | `#f7f4ed` | Page background |
| `--card` | `#f7f4ed` | Card surface (same as page; borders separate) |
| `--ink` | `#1c1c1c` | Primary text, headings |
| `--ink-2` | `#3f3f3d` | Secondary text (charcoal 83%) |
| `--muted` | `#5f5f5d` | Captions, metadata. 5.83:1 on cream, passes AA at any size |
| `--line` | `#eceae4` | Passive borders, dividers |
| `--line-strong` | `rgba(28,28,28,0.4)` | Interactive borders |
| `--tint` | `rgba(28,28,28,0.04)` | Hover surfaces, micro-tints |

### Dark (derived)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#1a1917` | Warm-tinted dark, not neutral black |
| `--card` | `#232220` | Card surface, one step up from page |
| `--ink` | `#f7f4ed` | Primary text (cream on dark) |
| `--ink-2` | `#d6d2c8` | Secondary text |
| `--muted` | `#a5a099` | Captions |
| `--line` | `#33312d` | Passive borders |
| `--line-strong` | `rgba(247,244,237,0.35)` | Interactive borders |
| `--tint` | `rgba(247,244,237,0.05)` | Hover surfaces |

### Phase colours (data, not palette)

Each has a light and dark value and must clear AA against its own surface.

| Phase | Light | Dark | Meaning |
|---|---|---|---|
| period | `#c0392f` | `#e8615a` | Bleeding |
| fertile | `#2f7d52` | `#4fbe86` | Fertile window |
| ovulation | `#1f6b45` | `#3fae76` | Peak fertility |
| pms | `#a8562a` | `#e08b5c` | Premenstrual |
| neutral | `#5f5f5d` | `#a5a099` | No signal |
| bc | `#5f5f5d` | `#a5a099` | Suppressed by birth control |

Darker than the current values, because the current ones fail AA as text
(see `anti-slop/audit-002-2026-09-17.md`, F-02 and F-06).

## 4. The Hero

The one place the design raises its voice.

**Structure:** the phase gradient is a soft wash in the **background layer**. The
text sits in a solid block over it, and the wash is tuned so the block clears AA
against the darkest area behind it. No white text on a light stop.

- Wash: two-stop linear gradient at low saturation, 10 to 18% of the phase hue
  over `--bg`. Atmospheric, not a saturated field.
- Title: 26px, weight 600, tracking `-0.02em`, `--ink`.
- Subtitle: 14px, weight 400, `--muted`.
- Cycle day: 12px, weight 600, uppercase, tracking `.04em`.

## 5. Typography Scale

| Role | Size | Weight | Tracking | Line height |
|---|---|---|---|---|
| Hero title | 26px | 600 | -0.02em | 1.25 |
| Section heading | 17px | 600 | -0.01em | 1.3 |
| Statistic | 44px | 600 | -0.03em | 1.0 |
| Card title | 15px | 600 | normal | 1.3 |
| Body | 14px | 400 | normal | 1.5 |
| Caption | 12px | 400 | normal | 1.45 |
| Label | 12px | 600 | normal | 1.3 |
| Button | 15px | 600 | normal | 1.0 |

No weight above 600. Hierarchy comes from size and colour, not weight.

## 6. Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | none | Page, cards (borders separate) |
| Inset | `rgba(255,255,255,0.2) 0 0.5px 0 inset, rgba(0,0,0,0.2) 0 0 0 0.5px inset` | Dark buttons only |
| Sheet | `0 -8px 30px rgba(0,0,0,.15)` | Bottom sheets only |
| Focus | `0 0 0 2px` ring | Keyboard focus |

Cards get **no shadow**. One border. This replaces the current
`0 1px 3px rgba(0,0,0,.05)` on every card.

## 7. Rules

**Do**
- Cream `#f7f4ed` as the foundation, in both modes via the token.
- Derive grays from one hue at varying alpha.
- `#eceae4` borders for containment; no card shadows.
- Inset shadow on dark buttons.
- Radius from the scale only.
- Phase colours for phase meaning, and nowhere else.

**Don't**
- Pure white page background.
- Weight 700 or 800.
- Card shadows.
- `9999px` on rectangular buttons.
- Letter-spacing above normal on headings.
- Saturated colour as decoration.
- A colour that fails AA against the surface it sits on.

## 8. Responsive

Single column, max width 480px, centred. This is a phone app.

| Width | Change |
|---|---|
| <360px | Tighten page padding to 12px; calendar cells fluid |
| 360-480px | Standard |
| >480px | Centred column, no reflow |

Tap targets: minimum 44px. The calendar cell is the tightest case and is
currently 38px, which fails; it becomes fluid with a 44px cap.

## 9. Verification

Every colour pair in this file was computed, not estimated. The method and the
results are in `anti-slop/audit-002-2026-09-17.md`. A token is added here only
after its contrast is checked in both modes.
