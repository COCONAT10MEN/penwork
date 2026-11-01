---
name: m3e-ui
description: Rules for building or changing any UI component, screen, or style in Penwork's Glass Expressive kit (Material 3 Expressive + tinted glass). Use whenever touching src/ui, src/theme, or any React component's look.
---

Before writing UI code:

1. Read `docs/DESIGN-GLASS.md` (material, colour, logo, performance), then `docs/DESIGN.md` (tokens, shapes, motion, states), and the
   matching mockup in `design/mockups/v2/`. When in doubt, follow the mockup.
2. Check `src/ui/` for an existing component first. Extend it with a prop instead of making a near-duplicate.

While building:

- Colors only from `var(--md-sys-color-*)`; radius from `var(--md-sys-shape-corner-*)`; type from the typescale tokens; glass from the `--pw-glass-*` tokens.
- Glass only through the `Surface` primitive: the frame is glass, the jewel is solid. Never nest glass. At most ~6 blurred layers on screen.
  Popovers and menus are solid until tested in the real Tauri window. Respect the Transparency setting.
- Motion only through the spring presets in `src/theme/motion.ts`; honor reduced motion. Press through `.pw-press` (`src/ui/press.ts`), never `:active`; hover only tints. The slide toolbar keeps the template's own look and timing.
- Interactive elements: real `<button>`/`<a>`/`<input>`, `aria-label` on icon-only buttons,
  `:focus-visible` ring, hover/pressed state layer, target ≥ 40px.
- Selected toggles morph from rounded square to circle on an effects spring.
- Both light and dark themes must look right.
- No new UI libraries.

When finished, add or update the component on the dev Gallery screen, in glass and tonal, and describe how it looks in light
and dark. If you can't see it rendered, say so.
