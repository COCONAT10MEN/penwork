# Glass Expressive: design rules (adds to `docs/DESIGN.md`)

Material 3 Expressive gives the **structure**: the shape scale, morphing selections, emphasized type,
spring motion, and colour roles generated from a seed. The owner's toolbar gives the **material**: tinted,
blurred, rim-lit glass. Everything in `docs/DESIGN.md` still applies except "no gradients, no glassmorphism".

Visual reference: `design/mockups/v2/` (home, edit, present, material). Match their feel. Token values in
`src/theme/` win over hard-coded colours in the mockups.

## 1. Two materials

| Material | Use for | Never use for |
|---|---|---|
| **Glass** | Floating chrome: dock, top bar, context toolbar, side panels (sorter, inspector), rail, status chips | Slide content, long reading text on thin glass |
| **Solid tonal** | Selected/active states, primary buttons, FABs, switches "on", selected swatches, inputs' fill, dialogs, **popovers and menus (see §7)** | Large background areas (looks flat next to glass) |

**The frame is glass, the jewel is solid.** A selected tool is a solid primary circle inside a glass capsule.
The selected colour swatch is a solid cookie shape. Primary actions are always solid.

## 2. Glass tokens (add to `src/theme/tokens.css`, generated per theme)

```css
/* fill: surface-container with a primary tint; two stops give the "tinted liquid" depth */
--pw-glass-tint:        color-mix(in oklab, var(--md-sys-color-primary) 10%, transparent);
--pw-glass-thin-fill:     linear-gradient(150deg, rgb(from var(--md-sys-color-surface-container-high) r g b / .78), rgb(from var(--md-sys-color-surface) r g b / .84));
--pw-glass-regular-fill:  linear-gradient(150deg, rgb(from var(--md-sys-color-surface-container-high) r g b / .82), rgb(from var(--md-sys-color-surface) r g b / .88));
--pw-glass-thick-fill:    linear-gradient(150deg, rgb(from var(--md-sys-color-surface-container-high) r g b / .93), rgb(from var(--md-sys-color-surface) r g b / .96));
--pw-glass-thin-blur: 16px;  --pw-glass-regular-blur: 24px;  --pw-glass-thick-blur: 32px;
--pw-glass-saturate: 1.7;
--pw-glass-rim:        1px solid rgb(255 255 255 / .18);      /* light theme: .80 */
--pw-glass-rim-top:    inset 0 1px 0 rgb(255 255 255 / .30);  /* light theme: .95 */
--pw-glass-sheen:      linear-gradient(180deg, rgb(255 255 255 / .05), rgb(255 255 255 / 0) 48%);   /* light theme: .12 */
--pw-glass-shadow:     0 18px 40px -14px rgb(0 0 0 / .60);     /* light theme: 0 16px 36px -18px rgb(16 40 48 / .32) */
```
(Generated in `theme.ts` per theme, so forced panels get their own glass. The fills are stronger than the first mockups: chrome sits
over white and black slides, and `theme.test.ts` checks that text reaches 4.5:1 over both, for several seeds. Secondary text inside
glass uses a stronger color for the same reason.)

A glass surface = fill + `backdrop-filter: blur(var(--blur)) saturate(var(--pw-glass-saturate))` + rim + rim-top +
a `::before` sheen layer + (floating only) shadow. Build it **once** as a `Surface` primitive in `src/ui/`
(`<Surface material="glass" strength="regular">` / `material="tonal"`) and make existing components
(Card, Menu, Dialog, NavigationRail, TopAppBar, Tooltip, SearchBar) take a `material` prop instead
of duplicating CSS.

## 3. What sits behind the glass

Glass needs colour behind it to look like glass.
- **Home / Edit backgrounds:** two or three large, very soft blobs in primary / tertiary / an accent over the surface
  colour. This echoes the deck's background blobs. **They are still by default**: moving blobs make every glass panel
  re-blur on every frame, even when the app is idle. Drifting can come back only if measured to be cheap, and must
  pause when the window isn't focused.
- **Mica is not in M1.** It needs a transparent window, text contrast would depend on the wallpaper, and the blobs
  mostly cover it. Optional in M7 if it proves worthwhile.
- **Present:** the slide itself is the background. Dock/popovers use regular/thick glass so they stay readable on
  white slides and dark covers.

## 4. Colour

- **App colour** is a setting (the seed for all chrome):
  - **Penwork teal (default):** the design's own colours, set exactly in `src/theme/theme.ts`. The owner chose this on
    2026-11-01 so that the app matches the mockups.
  - **Sync with logo:** the default Penwork logo uses the Windows accent colour. A custom logo uses its own single colour.
  - **Match the open deck:** the chrome's seed becomes the deck's `--teal` accent while a deck is open.
  - **Custom colour:** chosen with the ColorPicker.
- Glass text must reach **4.5:1** against the app's own background and its soft colours (`theme.test.ts`). App panels
  never sit over a slide; the show's dock has its own colours. Thin glass only carries short labels ≥ 13 px bold.
  Long text goes on thick glass.

## 5. Shape & type (unchanged from M3E, emphasised here)

Dock and pills: full radius. Panels: 28–32. Cards on Home: 24–32. Selected tool/size/segment: rounded square
(16) → circle, morphing with the spatial spring. Selected swatch: cookie shape. Headlines: emphasized weights
(800–850), large display size on Home ("Good evening").

## 6. Motion (owner rules come first)

- **Logo + dock are one body.** The capsule grows out of the logo with no seam, no separate fading pieces, **no bounce**,
  no tilt, and an equal frame thickness all round (`reference/lop-deck/HANDOFF.md` §3.10). Use a critically damped
  spring (damping ratio 1.0) for the dock, panels and popovers.
- Small controls (buttons, toggles, swatches) may use the expressive fast spring (slight overshoot).
- The selection indicator slides between tools as one shape (Motion `layoutId`).
- Popovers grow from their anchor button and never cover the dock.
- Reduce motion: springs become 150 ms fades.
- The existing `spatialDefault` spring (ratio 0.8) bounces slightly, so M1 adds a no-bounce preset (ratio 1.0) and moves
  dock, panels, popovers and menus onto it.

## 7. Fallbacks & performance (the owner's laptop: i7-8565U, 7.8 GB RAM)

The 1366×768 screen is driven by the **Intel UHD 620**, not the MX130, so measure on that.


- Setting **Transparency: Glass / Reduced** (default Glass; follows Windows "Transparency effects" when detectable).
  Reduced = the same shapes as solid tonal surfaces.
- At most **~6 blurred layers on screen**. Home cards don't need real blur: use a translucent fill without `backdrop-filter`.
  Glass inside glass loses its blur, so `Surface` must not be nested. Don't blur large full-window areas. Never animate `backdrop-filter` values.
- During slide transitions, the dock and chips may drop to a solid fill if frames drop (measure first).
- The handoff reports a possible **popover blanking bug with `backdrop-filter` in WebView2**. So popovers and menus start
  **solid** (thick fill, rim and sheen, no blur). Blur on popovers is only added after testing every one in the real Tauri window.
- Measure: Home must scroll and the dock must open at 60 fps on the laptop. Report the numbers in the milestone summary,
  with GPU load at idle on Home, not only frame rate.

## 8. Logo (dock and rail)

The Penwork cookie logo by default. Settings → Logo lets the user replace it. Requirements for a custom logo:

- **`.svg` only.** PNG and JPG are refused with a clear message, because the logo must scale cleanly.
- Square, with a `viewBox` (for example `0 0 100 100`).
- **One colour.** Multi-colour logos are refused, because the logo and its background swap colours.
- Transparent background: the app draws the background.
- 200 KB or smaller.
- Text converted to shapes. No scripts, animation, embedded images or outside links. The file is sanitised on import.

**Colour swap, exactly as the template:** closed, the logo is its colour on the background colour. Black is the default
background, the app sets it and the user can change it in Settings (it is not part of the SVG). As the dock opens, the two
swap: the logo takes the background colour and the background takes the logo colour. The animation is one body (§6).
