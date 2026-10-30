---
name: milestone
description: Work on one milestone from docs/ROADMAP.md, step by step, with a plan first.
argument-hint: "[milestone number, e.g. 0 or 3]"
disable-model-invocation: true
---

Work on milestone **M$ARGUMENTS** from `docs/ROADMAP.md`.

1. Read `CLAUDE.md`, `docs/PIVOT.md`, `docs/ROADMAP.md`, and whichever of `docs/DESIGN-GLASS.md`, `docs/DESIGN.md`,
   `docs/DECK-FORMAT.md`, `docs/EDITING.md`, `docs/ARCHITECTURE-DECKS.md` and `docs/TEMPLATE-PARITY.md` the milestone touches.
   For UI work, also open the matching file in `design/mockups/v2/`. For the engine, dock or ink, use `reference/lop-deck/` as the
   spec, and when it disagrees with a doc about behaviour, the code wins.
2. Find the unticked items of M$ARGUMENTS. If an earlier milestone still has unticked items that this one
   depends on, say so and stop.
3. Write a short plan: the items you'll do in this session (pick a sensible chunk, not everything at once),
   files you'll add or change, new dependencies (with license), and how you'll verify each item.
   **Wait for the owner to say ok.**
4. Implement one item at a time. After each item:
   - run the checks (same as `/check`) and fix problems,
   - commit with a clear message,
   - tick the box in `docs/ROADMAP.md` only if it was verified.
5. When done (or when the session gets long), finish with:
   - what was completed,
   - click-by-click steps for the owner to test it with the mouse in `npm run tauri dev`,
   - what's next in this milestone.
