# design.md: Soft Health-Tracker UI (Flo-style layout and visual system)

A detailed design spec for a calm, friendly cycle/health-tracker mobile app. The layout and visual language follow the general patterns of popular cycle trackers such as Flo: a big circular status dial on the home screen, a vertically scrolling calendar with circled days, bottom-sheet logging, rounded cards on a warm off-white background, and a 4 to 5 tab bottom bar.

> Notes on accuracy: this is a recreation from observed patterns and public design critiques, not Flo's official design files. Exact pixel values, tab names, and card order vary by app version and A/B tests, so treat every number as a starting point. Use your own illustrations, icons, copy, and name.

---

## 0. Table of contents

1. Design principles
2. Layout system (grid, safe areas, screen anatomy)
3. Navigation structure
4. Screen-by-screen layout (wireframes and measurements)
5. Color tokens
6. Typography
7. Spacing, radius, elevation
8. Components
9. Iconography and illustration
10. Motion
11. Voice and content
12. Privacy UI
13. Implementation notes
14. Checklist

---

## 1. Design principles

1. **Calm over clinical.** Health data feels gentle, never like a hospital form.
2. **One hero per screen.** Each screen has one focal element (dial, calendar, chart). Everything else supports it.
3. **Color = meaning.** Each phase or state has exactly one color, used the same way everywhere.
4. **Roundness everywhere.** Cards, buttons, chips, inputs, and sheets are generously rounded.
5. **Low-friction logging.** Common actions take 1 to 2 taps, with big targets.
6. **Reassuring copy.** Short, warm, non-judgmental. Predictions are always estimates.
7. **The answer first.** The home screen answers "where am I in my cycle, and what's next?" without any tapping.

---

## 2. Layout system

### 2.1 Reference viewport

Design at **390 x 844 pt** (iPhone 14/15) and verify at **360 x 800 dp** (small Android) and **430 x 932** (large phone). All measurements below assume 390 wide.

```
+--------------------------------+  y = 0
| Status bar / safe-area top     |  47 (iOS notch) / 24-32 (Android)
+--------------------------------+
| Top bar (optional per screen)  |  56
+--------------------------------+
|                                |
| Scrollable content             |  flexible
|                                |
+--------------------------------+
| Bottom tab bar                 |  64 + safe-area bottom (34 on iOS)
+--------------------------------+  y = 844
```

### 2.2 Grid and margins

- **8 pt base grid.** All spacing is a multiple of 4, preferably 8.
- **Screen side margins:** 20 pt. Content width on 390 = 350.
- **Card gutter (between cards side by side):** 12 pt.
- **Vertical gap between sections:** 24 pt. Between a section title and its content: 12 pt.
- **Vertical gap between stacked cards:** 12 to 16 pt.
- **Full-bleed exceptions:** the hero background gradient, horizontal carousels (they bleed off the right edge to hint at scrolling), and article hero images.

### 2.3 Safe areas and scrolling rules

- Content scrolls under a translucent top bar and stops above the tab bar. Add bottom padding equal to tab bar height plus 16 so the last card is never hidden.
- Top bar background is transparent at scroll offset 0, then becomes `--bg` at 90% opacity with a hairline border after about 8 pt of scroll.
- The bottom tab bar is docked (not floating), always visible on the five main screens, and hidden on modal flows such as onboarding, article reader, and full-screen logging.
- Primary action buttons that must always be reachable are **sticky** at the bottom, 16 pt above the safe area, with a soft gradient fade behind them (`transparent` to `--bg`, 24 pt tall).

### 2.4 Layout rhythm summary

| Zone | Height / size | Notes |
|---|---|---|
| Status bar | 47 | System |
| Top bar | 56 | Title or greeting left, 1 to 2 icon buttons right (40 x 40 tap area) |
| Hero block | 300 to 380 | Dial or calendar, centered |
| Section title | 24 | H2, 20 pt left margin |
| Card | 96 to 200 | Radius 24, 16 to 20 padding |
| Tab bar | 64 + inset | 5 equal-width slots |
| Sticky CTA | 52 | Pill, side margins 20 |

---

## 3. Navigation structure

### 3.1 Bottom tab bar (5 slots, equal width 78 pt each)

| Order | Tab | Icon (outline, filled when active) | Contains |
|---|---|---|---|
| 1 | **Today** | home or circle-dial | Hero dial, quick logging, daily insights |
| 2 | **Calendar** | calendar | Scrollable months, edit period dates |
| 3 | **Insights** | sparkle or book | Articles, stories, courses, tips |
| 4 | **Community** | chat bubbles | Anonymous topic chats (optional) |
| 5 | **Profile** | person | Settings, reminders, data, subscription |

Tab names and count vary between versions of these apps. If you don't need Community, use 4 tabs with 97 pt slots.

**Tab bar visual:**
- Background `--surface`, top hairline `--border`.
- Icon 24 pt, label 11 pt / 500 weight, 4 pt gap between icon and label.
- Active: icon filled and label in `--primary`. Inactive: outline and `--text-muted`.
- No indicator bar or pill. The color change (and filled icon) is the only active cue.
- Optional small badge dot (8 pt, `--primary`) on Insights for new content.

### 3.2 Screen hierarchy

```
Onboarding (linear, no tab bar)
  -> Paywall (dismissable)
  -> Main tabs
       Today
         -> Log sheet (bottom sheet)
         -> Edit period dates (full sheet)
         -> Article reader (push)
       Calendar
         -> Day detail / log sheet
         -> Edit period dates
       Insights
         -> Article / Story / Course (push)
       Community
         -> Chat room (push)
       Profile
         -> Settings pages (push)
         -> Reminders, Data, Privacy, Subscription
```

### 3.3 Transitions

- Tab switch: cross-fade, 150 ms, no slide.
- Push: standard platform slide, 300 ms.
- Sheets: rise from bottom with spring, 320 ms, scrim fades to 40%.

---

## 4. Screen-by-screen layout

### 4.1 Today (home)

The most important screen. Its job is to answer "what phase am I in and what's next" at a glance, then invite a quick log.

```
390 x 844

+------------------------------------------+ 0
| status bar                               |
+------------------------------------------+ 47
| Today, Sep 30  v              (bell) (cog)|  top bar, 56
+------------------------------------------+ 103
|  M    T    W    T    F    S    S          |  week strip, 72
|  25   26   27   28   29   (30)  1         |  today = filled circle
+------------------------------------------+ 175
|                                          |
|              .-~~~~~~~-.                  |
|           .-'  arcs by  '-.               |
|          /     phase       \              |  hero dial
|         |    Period in       |             |  260 x 260
|         |      6 days        |             |  ring stroke 14
|          \   (big number)   /              |
|           '-.           .-'               |
|              '-~~~~~~~-'                   |
|                                          |
|      [    Log period    ]  (pill 52)      |  primary CTA
+------------------------------------------+ ~575
|  How are you feeling today?               |  H2
|  [Symptoms] [Mood] [Sleep] [Water] ->     |  horizontal chips/cards
+------------------------------------------+ ~690
|  Your daily insights                      |  H2
|  +--------------------------------------+ |
|  | illustration | Title of insight      | |  insight card 112 tall
|  |              | 3 min read            | |
|  +--------------------------------------+ |
|  +--------------------------------------+ |
|  | ...                                  | |
+------------------------------------------+
| Today  Calendar  Insights  Chat  Profile |  tab bar
+------------------------------------------+ 844
```

**Zone details**

1. **Top bar (56).** Left: date or greeting in H2 with a small chevron if it opens a date picker. Right: up to two 40 x 40 icon buttons (notifications, settings shortcut). No bottom border at scroll 0.
2. **Week strip (72).** Seven equal cells (about 50 pt each). Each cell: weekday initial (caption, muted) above a date number in a 36 pt circle. Today = filled `--text` or `--primary` circle with white number. Period days show a small colored dot under the number. The strip is horizontally swipeable by week. Tapping a date updates the dial and cards for that date.
3. **Hero dial (260 x 260, centered, top margin 16).**
   - Ring: 14 pt stroke, round caps, gaps of 2 to 3 degrees between phase arcs.
   - Arcs colored by phase (period pink, neutral lavender, fertile blue, peak deeper blue). Future arcs are drawn at 35% opacity. Predicted period arc is dashed.
   - A 20 pt white knob with a colored border marks today's position on the ring.
   - Center stack, vertically centered: a small caption above ("Period" / "Ovulation in"), a **Display number** ("6") with the unit below ("days"), and a one-line status caption ("Low chance of getting pregnant") in muted text.
   - Behind the dial: a soft radial gradient blob from `--primary-soft` at 60% to transparent, about 340 pt wide, offset upward. Never a hard edge.
   - Tapping the dial opens a cycle detail sheet (phase description and dates).
4. **Primary CTA (52 tall, top margin 20).** Pill button, width 220 to 300 and centered (or full width). Label switches by state: "Log period" (default), "Period started" or "Edit dates" (during a period), "Log ovulation test" (fertile window).
5. **Quick-log row (top margin 28).** Section title left, optional "See all" right. Below, a horizontally scrolling list of 104 x 96 cards or 40 pt tall chips. Each has an icon (32 pt) in a tinted circle and a label. The last card bleeds off the right edge.
6. **Daily insights (top margin 28).** Vertical stack of cards. Layout: 96 x 96 illustration tile at left (radius 20), text column at right (category label in `--primary` caption, title in Body L bold, 2 lines max, read time caption). Optionally, the first card is a larger hero card, full width, 16:10 image on top.
7. **Extras (optional, below insights).** Promo or upsell card (tinted `--surface-alt`, one illustration, one line, one button), partner-sharing card, and a "Your cycle at a glance" mini stats card (average cycle length, average period length).

**States**
- *Period active:* dial center shows "Day 2" plus "of period"; CTA reads "Edit dates". Background gradient shifts toward pink.
- *Fertile window:* center reads "Fertile window" with blue accent; gradient shifts toward blue.
- *Late period:* center reads "Period is 2 days late" in a neutral, non-alarming tone; CTA offers "Log period" and a secondary link "It's not coming".
- *No data (first run):* dial shows a dashed empty ring and a CTA "Add your last period".

### 4.2 Calendar

A vertically scrolling, continuous calendar (months stacked, not paged), with the current month roughly at the top on open.

```
+------------------------------------------+
| Calendar                       (today)    |  top bar 56
+------------------------------------------+
|  M    T    W    T    F    S    S          |  sticky weekday header, 32
+------------------------------------------+
|  September 2026                           |  month title, 40
|                                           |
|  (28) (29) (30)  1    2    3    4         |  rows 56 tall
|   5    6    7    8   [9]  [10] [11]        |  [ ] = period days
|  (12) ...                                 |
|  ...                                      |
|                                           |
|  October 2026                             |
|   ...                                     |
+------------------------------------------+
|  o Period  o Fertile  o Ovulation         |  legend row (sticky above CTA)
|  [       Edit period dates       ]        |  sticky CTA
+------------------------------------------+
| tab bar                                  |
+------------------------------------------+
```

**Measurements**
- Weekday header: 7 columns, 50 pt each, caption style, muted. Sticky under the top bar.
- Month title: H2, left-aligned at 20 pt margin, 24 pt above the grid and 12 below.
- Day cell: 50 wide x 56 tall. The day number is centered in a 40 pt circle. Numbers in Body, tabular figures.
- Row gap: 4 pt. No grid lines. The structure comes from spacing alone.
- Days outside the current month are hidden (blank), not greyed out.

**Day cell states**

| State | Visual |
|---|---|
| Normal | Number only, `--text` |
| Today | 2 pt `--text` ring, number bold |
| Logged period | Solid `--phase-period` circle, white number |
| Predicted period | Dashed `--phase-period` 2 pt circle outline, `--phase-period` number |
| Fertile window | `--phase-fertile` circle at 20 to 25% fill, `--text` number |
| Ovulation / peak | Solid `--phase-peak` circle, white number (or a small drop icon) |
| Has a log entry | 5 pt dot under the number in `--text-muted` |
| Selected | 2 pt `--primary` ring plus bounce animation |

- Consecutive period days may be joined by a continuous rounded pill (a capsule behind the numbers) instead of separate circles. This reads as one event.
- Tap a day to open the log bottom sheet for that date. Long-press or "Edit period dates" enters multi-select mode where tapping cells toggles them and the CTA becomes "Save".

**Legend row (36 tall):** three items, each a 10 pt colored dot plus caption. Sits above the sticky CTA.

### 4.3 Log / daily entry (bottom sheet)

```
+------------------------------------------+
| (dim scrim over previous screen)          |
|                                           |
+------------------------------------------+ sheet top, radius 28
|              ----- (handle)               |
|  Sep 30                       (x)         |  title row 56
|------------------------------------------|
|  Period                                   |  section H2
|  [ Light ] [ Medium ] [ Heavy ]           |  segmented chips
|                                           |
|  Symptoms                                 |
|  [Cramps] [Headache] [Bloating] [Acne]    |  wrapping chip grid
|  [Backache] [Nausea] [Fatigue] ...        |
|                                           |
|  Mood                                     |
|  (:D) (:)) (:|) (:() (>:()                |  emoji chips
|                                           |
|  Notes  [ Add a note...              ]    |
|                                           |
|  [            Save                 ]      |  sticky pill
+------------------------------------------+
```

- Height: 85% of screen, draggable to dismiss, scrolls internally.
- Section spacing 24, chip spacing 8 (horizontal and vertical).
- Each chip: 40 tall, pill, icon 20 pt at left, 12 pt horizontal padding.
- Selected chips fill `--primary` with white text and a small check.
- Save button is sticky at the bottom with a fade gradient. It is disabled until something changes.

### 4.4 Insights (content feed)

```
+------------------------------------------+
| Insights                       (search)   |
+------------------------------------------+
| [For you] [Cycle] [Nutrition] [Sleep] ... |  category chips, scrollable, 40
+------------------------------------------+
|  Stories                                  |
|  (o)  (o)  (o)  (o)  ->                   |  story circles 72 pt, ring gradient
+------------------------------------------+
|  +--------------------------------------+ |
|  |            16:10 image               | |  featured card
|  |  CATEGORY                             | |
|  |  Big bold title                       | |
|  |  4 min read                           | |
|  +--------------------------------------+ |
|  +----------------+ +-------------------+ |
|  | half card      | | half card         | |  2-column grid
|  +----------------+ +-------------------+ |
+------------------------------------------+
```

- Category chips: single row, horizontally scrollable, selected chip filled.
- Story circles: 72 pt avatar with a 3 pt gradient ring for unseen, grey ring for seen. Tapping opens a full-screen story with a segmented progress bar at the top and tap left/right to navigate.
- Featured card is full width, radius 24, image on top, text below on `--surface`.
- Half cards: (350 - 12) / 2 = 169 wide, 4:5 image, title 2 lines.

### 4.5 Community (optional)

- Top: search field (radius 16, 48 tall). Below: horizontally scrolling topic chips.
- List of chat rooms: rows 72 tall with a 48 pt rounded-square avatar (tinted with emoji or icon), title bold, one-line last message muted, participant count and time at right.
- Chat room: standard bubbles, incoming on `--surface-alt`, outgoing on `--primary-soft`. Anonymous handles (adjective + animal), never real names.

### 4.6 Profile / Settings

- Header: 72 pt avatar (or illustrated placeholder), name or "Anonymous", subscription status pill.
- Grouped list sections in rounded cards (radius 24, rows 56 tall, 20 pt padding, chevrons at the right, hairline separators inset 56 pt to align with text).
- Suggested groups: **My cycle** (cycle length, period length, goals), **Reminders**, **Privacy and data** (passcode, export, delete), **Subscription**, **Help**, **About**.
- Destructive rows (Delete account) live in a separate group at the bottom with red text, and always confirm in a sheet.

### 4.7 Onboarding (long, linear)

A questionnaire-style flow. Many apps of this type use dozens of screens, so keep yours much shorter (8 to 12) and allow skipping.

```
+------------------------------------------+
| (<)   [==========--------------]   Skip   |  progress row 48
|                                           |
|                                           |
|        (illustration 200 x 200)           |
|                                           |
|   What's your main goal?                  |  H1, centered or left
|   We'll personalize your experience.      |  Body muted
|                                           |
|  +--------------------------------------+ |
|  | (icon)  Track my period            ( )| |  option card 64 tall
|  +--------------------------------------+ |
|  +--------------------------------------+ |
|  | (icon)  Get pregnant               ( )| |
|  +--------------------------------------+ |
|                                           |
|  [           Continue            ]        |  sticky pill
+------------------------------------------+
```

- No tab bar. Progress bar 4 pt tall, `--primary` on `--primary-soft`.
- One question per screen. Big headline (H1), one line of support text, then options.
- Option cards: full width, radius 20, 64 to 72 tall, 16 padding, 1.5 pt `--border`. Selected: 2 pt `--primary` border, `--primary-soft` fill, filled radio or check at right.
- Date pickers use a native wheel or a compact calendar in a card. Number pickers use a horizontal ruler-style scroller.
- Interstitials: educational screens with a big illustration and one line ("Your data stays private") break up long question runs.
- End of flow: account/sign-in screen (Apple, Google, email, and "Continue without account"), then paywall, then Today.

### 4.8 Paywall

- Full screen, X close button top-right (44 x 44), no delay on close.
- Top 40%: illustration on a soft gradient. Headline H1, then 4 to 5 benefit rows (check icon 20 pt, Body).
- Plan cards side by side or stacked: 2 cards, radius 24, 2 pt border. Highlighted plan gets `--primary` border, a "Best value" pill overlapping the top edge, price in H2, per-month equivalent in caption.
- Primary CTA 52 tall, then a one-line billing clarity note ("Cancel anytime. Billed yearly."), and small links: Restore, Terms, Privacy.

### 4.9 Edit period dates (full sheet)

- Same calendar as 4.2, in selection mode, with a top bar reading "Edit period dates" and a Cancel / Save pair.
- Tapping a day toggles it as a period day. Dragging across days selects a range.
- Info banner (tinted `--surface-alt`, radius 16) at the top: "Tap the days your period started and ended."

### 4.10 Empty, loading, and error states

- **Loading:** skeleton blocks in `--surface-alt` with a slow shimmer. The dial shows a pulsing ring.
- **Empty:** small illustration (120 pt), one friendly line, one action.
- **Error / offline:** inline banner at the top of the content, radius 16, `--warning` tint, with a retry action. Never blocks logging (queue locally).

---

## 5. Color tokens

### Brand and neutrals

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FFF8F8` | `#16121A` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | `#221C28` | Cards, sheets, tab bar |
| `--surface-alt` | `#FDEEF0` | `#2C2433` | Tinted cards, chips |
| `--text` | `#2B2230` | `#F6EEF4` | Primary text |
| `--text-muted` | `#8A7F90` | `#A99FB0` | Secondary text |
| `--border` | `#F1DDE1` | `#3A3042` | Hairlines |
| `--primary` | `#F0507A` | `#FF6B93` | CTA, period color |
| `--primary-soft` | `#FFD9E3` | `#4A2A38` | Primary tint backgrounds |

### Semantic phase colors

| Token | Hex | Meaning |
|---|---|---|
| `--phase-period` | `#F0507A` | Period (solid) |
| `--phase-predicted` | `#F0507A` at 40% | Predicted (dashed outline) |
| `--phase-follicular` | `#B58DE8` | Follicular (optional 4-phase mode) |
| `--phase-fertile` | `#5BB8E8` | Fertile window |
| `--phase-peak` | `#2F8FD0` | Ovulation / peak |
| `--phase-luteal` | `#7CCB9B` | Luteal (optional 4-phase mode) |
| `--phase-neutral` | `#B9A8C9` | Other days |
| `--success` | `#4CC38A` | Confirmations |
| `--warning` | `#F5A94A` | Gentle cautions |
| `--danger` | `#E5484D` | Destructive only |

### Gradients

- Hero backdrop: `radial-gradient(60% 60% at 50% 30%, var(--primary-soft) 0%, transparent 100%)`
- Sticky CTA fade: `linear-gradient(to top, var(--bg) 40%, transparent)`
- Premium / paywall: `linear-gradient(160deg, #FFD9E3 0%, #E9DDFB 100%)`

### CSS

```css
:root {
  --bg:#FFF8F8; --surface:#FFFFFF; --surface-alt:#FDEEF0;
  --text:#2B2230; --text-muted:#8A7F90; --border:#F1DDE1;
  --primary:#F0507A; --primary-soft:#FFD9E3;
  --phase-period:#F0507A; --phase-fertile:#5BB8E8;
  --phase-peak:#2F8FD0; --phase-neutral:#B9A8C9;
  --phase-follicular:#B58DE8; --phase-luteal:#7CCB9B;
  --success:#4CC38A; --warning:#F5A94A; --danger:#E5484D;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#16121A; --surface:#221C28; --surface-alt:#2C2433;
    --text:#F6EEF4; --text-muted:#A99FB0; --border:#3A3042;
    --primary:#FF6B93; --primary-soft:#4A2A38;
  }
}
```

**Accessibility:** body text 4.5:1 minimum. White on `--primary` is fine for large or bold text; check small text. Never rely on color alone: predicted days use dashes, peak days use an icon, and the legend labels everything.

---

## 6. Typography

- **Family:** rounded or geometric humanist sans. Free options: *Nunito*, *Poppins*, *DM Sans*, *Manrope*. Fallback: `system-ui, -apple-system, Roboto, sans-serif`.
- **Feel:** friendly, slightly bold headings, airy body.

| Style | Size / Line | Weight | Use |
|---|---|---|---|
| Hero number | 56 / 60 | 700 | Dial center ("6") |
| Display | 32 / 38 | 700 | Section hero text |
| H1 | 24 / 30 | 700 | Screen and onboarding titles |
| H2 | 20 / 26 | 600 | Section titles |
| Body L | 17 / 24 | 400 to 600 | Card titles, article body |
| Body | 15 / 22 | 400 | Default |
| Caption | 13 / 18 | 500 | Labels, metadata |
| Tab label | 11 / 14 | 500 | Bottom tabs |
| Button | 16 / 20 | 600 | Buttons |

Sentence case throughout. Tabular figures for the dial, calendar, and stats. Respect the system text-size setting up to 130% and reflow (never truncate the dial center).

---

## 7. Spacing, radius, elevation

- **Spacing scale (pt):** 4, 8, 12, 16, 20, 24, 32, 48
- **Radius:** chips and buttons 999, small cards 20, cards 24, sheets 28 (top corners), inputs 16, illustration tiles 20
- **Elevation:** nearly flat. Prefer tint and hairlines to shadows.
  - Card (optional): `0 4px 20px rgba(240, 80, 122, 0.08)`
  - Sheet: `0 -8px 32px rgba(43, 34, 48, 0.12)`
  - Tab bar: none (hairline top border only)
- **Touch targets:** minimum 48 x 48 (icon buttons 40 visual, 48 tappable).

---

## 8. Components

### Buttons

| Type | Style |
|---|---|
| Primary | Pill, `--primary` fill, white text, height 52 |
| Secondary | Pill, `--primary-soft` fill, `--primary` text, height 52 |
| Tertiary | Text only, `--primary` |
| Icon button | 40 circle, `--surface` fill, hairline border |
| Destructive | Pill outline, `--danger` text, confirm in sheet |

States: pressed = darken 8% and scale 0.98; disabled = 40% opacity; loading = spinner replaces label, width stays fixed.

### Cards

Radius 24, `--surface`, 16 to 20 padding, optional soft shadow. Tinted variants use `--surface-alt` or a phase color at 12 to 15%.

### Chips

Pill, 36 to 40 tall, icon 20 pt left, 12 pt horizontal padding, unselected `--surface-alt`, selected `--primary` with white text and check. Multi-select unless in a segmented group.

### Segmented control

Pill container `--surface-alt`, 4 pt inner padding, selected segment is a `--surface` pill with soft shadow.

### Inputs

Radius 16, 52 tall, `--surface`, 1 pt `--border`, focus 2 pt `--primary`. Label above, helper below in muted caption. Error uses `--danger` border and helper text.

### Toggles and sliders

Toggle on = `--primary`, 51 x 31. Slider track `--primary-soft`, filled portion `--primary`, 28 pt white thumb with shadow.

### Bottom sheets

Top radius 28, handle 40 x 4 in `--border` centered 8 pt from the top, scrim `rgba(43, 34, 48, 0.4)`. Detents at 50% and 90%.

### List rows

56 tall, 20 pt side padding, leading icon in 32 pt tinted circle, title Body, optional value at right in muted, chevron 16 pt.

### Progress bars

4 pt (onboarding) or 8 pt (stats) tall, fully rounded, track `--primary-soft`, fill `--primary`.

### Badges

Small pill, 20 tall, caption 11 pt bold, e.g. "New" or "Best value", `--primary` on white or white on `--primary`.

---

## 9. Iconography and illustration

- **Icons:** 24 pt, 1.75 to 2 pt stroke, rounded caps and joins. Suggested sets: Phosphor (Rounded), Lucide, Material Symbols Rounded. Filled variants only for active tabs and selected states.
- **Illustration:** flat, soft, slightly abstract, organic blobs and simple figures in the palette. Avoid literal anatomy. Use blob backgrounds behind icons on cards.
- **Illustration sizes:** insight tile 96, empty state 120, onboarding 200, paywall header 240.
- **Emoji:** used sparingly for mood chips only.

---

## 10. Motion

- Duration 200 to 300 ms, ease-out. Sheets 320 ms with a gentle spring (damping about 0.85).
- Dial: arcs sweep in on first load (600 ms, staggered by 80 ms per arc). The center number counts up or cross-fades on change.
- Chip select: scale 1.0 to 1.06 to 1.0 (180 ms), fill color fades in.
- Calendar select: circle scales from 0.6 to 1.0 with a soft bounce.
- Week strip: snap scrolling, today's circle animates when a new date is selected.
- Light haptic on log confirm and on chip select.
- Respect reduced-motion: replace sweeps and bounces with simple fades.

---

## 11. Voice and content

- Warm, supportive, plain language, second person.
- Avoid jargon without a short explanation.
- Predictions are always estimates: "Your period may start around Oct 4."
- Status lines are reassuring: "Low chance of getting pregnant", "Your body is doing its thing."
- Errors are calm and actionable: "Couldn't save. Check your connection and try again."
- Buttons are verbs: "Log period", "Save", "Continue".

---

## 12. Privacy and trust UI (recommended for health apps)

- Lock icon and one-line reassurance near sensitive inputs and on the sign-in screen.
- **Anonymous mode / continue without account** option.
- Settings: passcode or biometric lock, hide app name or icon option, **Export my data**, **Delete my data**.
- Ask for permissions in context with a friendly pre-prompt before the system dialog.
- Never show sensitive details in notification text by default (use a neutral title such as "Time to check in").

---

## 13. Implementation notes

- **Web/PWA:** CSS variables above, CSS grid for the calendar (`grid-template-columns: repeat(7, 1fr)`), SVG `stroke-dasharray` arcs for the dial, `position: sticky` for the weekday header and CTA, `env(safe-area-inset-*)` for insets.
- **Android (Compose):** Material 3 with a custom `ColorScheme`, `RoundedCornerShape(24.dp)` cards, `Canvas` for the dial, `LazyColumn` for months, `ModalBottomSheet` for logging, `NavigationBar` with no indicator color.
- **Flutter:** `ThemeData` from tokens, `CustomPainter` for the dial, `SliverList` for months, `showModalBottomSheet(isScrollControlled: true)`.
- **React Native:** tokens file, `react-native-svg` for the dial, `FlashList` for months, `@gorhom/bottom-sheet` for sheets.

### Dial arc sketch (SVG)

```html
<svg viewBox="0 0 200 200" width="260" height="260">
  <!-- base ring -->
  <circle cx="100" cy="100" r="84" fill="none"
          stroke="var(--phase-neutral)" stroke-width="14" opacity=".35"/>
  <!-- period arc: dasharray = "arcLength circumference" (2*pi*84 = 528) -->
  <circle cx="100" cy="100" r="84" fill="none"
          stroke="var(--phase-period)" stroke-width="14" stroke-linecap="round"
          stroke-dasharray="90 528" transform="rotate(-90 100 100)"/>
  <!-- fertile arc: rotate by its start angle -->
  <circle cx="100" cy="100" r="84" fill="none"
          stroke="var(--phase-fertile)" stroke-width="14" stroke-linecap="round"
          stroke-dasharray="110 528" transform="rotate(20 100 100)"/>
  <!-- today knob -->
  <circle cx="100" cy="16" r="10" fill="#fff"
          stroke="var(--phase-period)" stroke-width="3"/>
  <text x="100" y="108" text-anchor="middle" font-size="56"
        font-weight="700" fill="var(--text)">6</text>
  <text x="100" y="132" text-anchor="middle" font-size="15"
        fill="var(--text-muted)">days</text>
</svg>
```

Arc math: arc length = (phase days / cycle length) x circumference. Rotation = (start day / cycle length) x 360 - 90 degrees.

### Suggested data model (for the dial and calendar)

```json
{
  "cycleLength": 28,
  "periodLength": 5,
  "lastPeriodStart": "2026-09-24",
  "phases": [
    { "type": "period",   "startDay": 1,  "endDay": 5  },
    { "type": "fertile",  "startDay": 11, "endDay": 16 },
    { "type": "peak",     "startDay": 14, "endDay": 14 }
  ],
  "logs": { "2026-09-30": { "symptoms": ["cramps"], "mood": "calm" } }
}
```

---

## 14. Checklist before shipping

- [ ] Today screen answers the phase and next-event question with no tap
- [ ] Phase colors are identical across dial, calendar, week strip, and legends
- [ ] Every color-coded state also has a non-color cue (dash, icon, label)
- [ ] All touch targets are at least 48 pt
- [ ] Text contrast is at least 4.5:1 in light and dark modes
- [ ] Sticky CTAs never cover content (bottom padding added)
- [ ] Tab bar hidden on onboarding, reader, and full-screen flows
- [ ] Every empty state has an illustration and an action
- [ ] Skeleton loading on Today and Insights
- [ ] Reduced-motion, large-text, and screen-reader labels tested
- [ ] Original illustrations, icons, and copy only (no copied brand assets)
