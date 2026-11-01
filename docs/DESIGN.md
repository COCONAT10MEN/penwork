# Design spec — Material 3 Expressive

The app now uses **Glass Expressive**: this file gives the structure, and `docs/DESIGN-GLASS.md` adds the glass material and
wins where the two disagree.

Visual references: `design/mockups/v2/` (open the HTML files in a browser). The older mockups in `design/mockups/` are for the paused PDF and notebook work.
Starting token values: `design/tokens.css` (hand-matched; M1 replaces them with generated values).

## Principles

1. **Content first.** The PDF page or notebook page is the hero; chrome floats around it.
2. **Expressive, not noisy.** Bold headlines, big soft shapes and springy motion, but one accent at a time.
3. **Tonal surfaces, not borders.** Separate areas with surface-container steps, not lines.
4. **Everything reachable by mouse in one or two clicks, and by keyboard.**

## Color

- Generated from a **seed color** with `@material/material-color-utilities`
  (`SchemeTonalSpot` by default; offer `SchemeVibrant` / `SchemeExpressive` as a setting).
- Seed: Penwork teal `#00687A` by default. Settings can follow the Windows accent or a custom colour.
- Expose every role as a CSS variable: `--md-sys-color-<role>`, e.g.
  `primary, on-primary, primary-container, on-primary-container, secondary…, tertiary…, error…,
  surface, surface-dim, surface-bright, surface-container-lowest|low|(none)|high|highest,
  on-surface, on-surface-variant, outline, outline-variant, inverse-surface, inverse-on-surface,
  inverse-primary, scrim, shadow`.
- Usage:
  - App background: `surface`. Side panels: `surface-container-low`. Viewer backdrop: `surface-container-highest`.
  - Selected nav item / selected chip: `secondary-container` + `on-secondary-container`.
  - Floating toolbar: `primary-container`; its selected tool: `primary` + `on-primary`.
  - Paired action button next to the toolbar (insert, undo on phone): `tertiary-container`.
- Highlighter colors are **content colors**, not theme colors: yellow `#FBD64A`, green `#A8E6B8`,
  pink `#F9B8DC`, blue `#A9C7FF`, orange `#FFC89A`, all at ~55% opacity (multiply blend).

## Shape scale (corner radius)

`--md-sys-shape-corner-`: `none 0`, `extra-small 4px`, `small 8px`, `medium 12px`, `large 16px`,
`large-increased 20px`, `extra-large 28px`, `extra-large-increased 32px`, `extra-extra-large 48px`, `full 9999px`.

- Chips 8, list items in panels 20, cards 24, side sheets/hero cards 28, buttons and toolbars full.
- **Shape morphing:** toggle buttons and toolbar tools are rounded squares (16) when idle and become
  circles (full) when selected. Corners ease on an effects spring, so they never bounce.
- Expressive shapes (cookie 9-point, clover 4-leaf) are SVG paths in `src/ui/shapes.ts`.
  Use them sparingly: logo, selected color swatch, empty states, avatar.

## Typography — Roboto Flex

| Token | Size / line height | Weight (normal → emphasized) |
|---|---|---|
| display-large / medium / small | 57/64 · 45/52 · 36/44 | 400 → 800 |
| headline-large / medium / small | 32/40 · 28/36 · 24/32 | 400 → 700 |
| title-large / medium / small | 22/28 · 16/24 · 14/20 | 500 → 700 |
| body-large / medium / small | 16/24 · 14/20 · 12/16 | 400 → 500 |
| label-large / medium / small | 14/20 · 12/16 · 11/16 | 500 → 700 |

- Screen titles use the **emphasized** display/headline styles (that's the "expressive" look).
- Use Roboto Flex's optical size axis (`font-optical-sizing: auto`).

## Motion

Use `motion` springs, never fixed-duration easing for movement. The values are Google's own, from
Compose's `ExpressiveMotionTokens.kt` (damping ratio / stiffness), and which spring goes where comes from
Compose's components. Motion's `damping` = ratio × 2 × √stiffness (mass 1).

| Preset | Use for | Ratio | Stiffness | → motion `damping` |
|---|---|---|---|---|
| spatial-fast | small things: press, menus, tooltips, FAB menu | 0.6 | 800 | ≈ 34 |
| spatial-default | things that cover part of the screen: dialogs, notices, sheets, the rail's pill | 0.8 | 380 | ≈ 31 |
| spatial-slow | full-screen arrivals | 0.8 | 200 | ≈ 23 |
| effects-fast | opacity beside spatial-fast | 1.0 | 3800 | ≈ 123 |
| effects-default | opacity and colour beside spatial-default; corners while pressed | 1.0 | 1600 | ≈ 80 |
| effects-slow | large fades | 1.0 | 800 | ≈ 57 |

- "Spatial" springs (position, size) overshoot: that is what makes it Expressive. "Effects" springs (colour, opacity,
  and corner shape on press) never do. Anything that moves and fades pairs one of each at the same speed.
- **Press** (`src/ui/press.ts`, class `.pw-press`). Never `:active`: size rides spatial-fast and corners effects-default,
  a released control waits until 75% of the press has played so a quick click still shows, and springs keep their speed
  when reversed. In a `data-press-group` the pressed control grows 15% and its neighbours give up the room.
- **Tooltips and menus** start at 0.8 and grow from the control that opened them. A tooltip's wait is 150 ms, and none
  once one is showing.
- **Navigation rail:** the pill grows out of its own centre on the destination. It doesn't slide across.
- Hover only tints (state layer). Nothing lifts or zooms.
- Reduced motion (OS setting or app setting): replace spatial springs with a 150 ms opacity fade.

## States

State layer = `on-*` color overlaid at: hover 8%, focus 10%, pressed 10%, dragged 16%.
Focus ring: 3px `secondary` outline with 2px offset, only on keyboard focus (`:focus-visible`).
Disabled: content 38% opacity, container 12% opacity.

## Elevation

Mostly flat (tonal). Shadows only on floating things: floating toolbar, FAB, menus, popovers, dialogs.
Use one soft shadow token: `0 4px 14px rgb(0 0 0 / 0.14)` (dark theme: `/ 0.4`).

## Icons

Material Symbols **Rounded**, weight 400, grade 0, optical size 24, `FILL 0` normally and `FILL 1`
when selected. Bundle the font locally.

## Screens (see mockups)

### Library (`library-desktop.html`)
- Navigation rail on the left (expanded with labels on wide windows, icons-only below 1100px).
- Pill search bar on top, emphasized "Good evening" headline, filter chips.
- Hero "Continue" card (primary-container, radius 28) + pinned card (tertiary-container).
- Recent grid of cards (surface-container, radius 24) with page thumbnails.
- FAB menu bottom-right: Import PDF / New notebook / Quick note.
- Import progress uses the wavy linear progress in a glass notice.

### PDF viewer + annotate (`pdf-desktop.html`)
- Top app bar: back, file name, subtitle, search, page chip, Sign (tonal tertiary), Save copy (filled).
- Center: pages on `surface-container-highest` backdrop, rounded 28 container.
- Floating toolbar centered at the bottom: tools as a button group (selected = circle),
  divider, highlight color swatches.
- Right side sheet "Annotations": count badge, segmented filter, list items with shaped icon containers.
- Thumbnails/outline open as a left side sheet.

### Notebook (`notebook-desktop.html`)
- Pages side sheet left, page canvas center, floating toolbar + tertiary FAB at the bottom.
- Pen settings popover (radius 28) above the toolbar: thickness slider (M3E slider with bar handle),
  color swatches (selected uses the cookie shape), switches.
- Mouse note: "Pressure changes thickness" switch is hidden until stylus support exists.

### Phone layouts (`library-android.html`, `notebook-android.html`)
Not built in v1, but keep components responsive so these work later.

## Don'ts

- No hard-coded hex colors in components (content colors like highlighters live in one constants file).
- No emoji as icons.
- Gradients and glass only as `docs/DESIGN-GLASS.md` describes.
- No borders to separate panels — use surface steps.
- Don't animate layout with CSS transitions where a spring is specified.
