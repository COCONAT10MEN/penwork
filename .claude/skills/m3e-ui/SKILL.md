---
name: m3e-ui
description: Rules for building or changing any UI component, screen, or style in Penwork's Material 3 Expressive kit. Use whenever touching src/ui, src/theme, or any React component's look.
---

Before writing UI code:

1. Read `docs/DESIGN.md` (tokens, shapes, motion, states) and the matching mockup in `design/mockups/`.
2. Check `src/ui/` for an existing component first. Extend it with a prop instead of making a near-duplicate.

While building:

- Colors only from `var(--md-sys-color-*)`; radius from `var(--md-sys-shape-corner-*)`; type from the typescale tokens.
- Motion only through the spring presets in `src/theme/motion.ts`; honor reduced motion.
- Interactive elements: real `<button>`/`<a>`/`<input>`, `aria-label` on icon-only buttons,
  `:focus-visible` ring, hover/pressed state layer, target ≥ 40px.
- Selected toggles and toolbar tools morph from rounded square to circle.
- Both light and dark themes must look right.
- No new UI libraries.

When finished, add or update the component on the dev Gallery screen and describe how it looks in light
and dark. If you can't see it rendered, say so.
