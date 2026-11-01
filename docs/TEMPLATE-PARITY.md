# Template parity: every feature of the Life of Physics template

**Owner's rule: not a single feature may be missing.** This list was taken from the template's real code
(`reference/lop-deck/deck-template.html`, `source/toolbar-ink-overview.js`), not only from `HANDOFF.md`.
When the code and a doc disagree about behaviour, the code wins. Anything found later that isn't listed here
gets added here. Tick a box only after checking it in the running app.

The look changes to Glass Expressive. The behaviour, settings and defaults below do not. One chosen change: ink strokes use
`perfect-freehand` instead of the template's own stroke drawing.

Milestone: slide engine items land in **M3**, dock, ink and whiteboard in **M5**.

Ticked items were checked in the running app, with simulated pen and touch input. Real stylus and touch hardware hasn't been tried.

## 1. Slide engine (ported as-is, M3)

- [x] 1920×1080 stage scaled and centred to fit any window, re-fit on resize
- [x] Steps: `.st` in document order, `data-st="="` together with the previous step, `.l` `.r` `.z` animations, ← hides again
- [x] Next on the last step goes to the next slide; next on the last slide loops to the cover
- [x] Back on step 0 goes to the previous slide, arriving fully revealed
- [x] Morph: `data-m` names, same-text `.fbox`, identical words glide (up to 34 per transition, stop-words ignored), cards and
      diagram frames glide and resize while content crossfades, everything else fades in staggered
- [x] Background blobs glide to each slide's `data-bg`; the stage turns dark on `.hero` slides
- [x] Diagram part highlighting: `data-part`, `data-hl`, `hasHL` dimming, latest visible step wins
- [x] Mini-LaTeX: every command in AI-GUIDE §6, stacked fractions, roots, units, Greek, unknown commands in red, `__tex()` for widgets
- [x] Widgets: `W.name(root)` runs once on first show; `data-onstep` calls `W.fn(section, step)`; `W.demo`
- [x] Quiz: from JSON, A–D options, right/wrong marking, others dimmed, feedback text, Next/Finish, score, Try again, maths inside
- [x] Every component in AI-GUIDE §3–§4: cover, chips, cards (soft, key, note, tips, vio), lists, formula boxes, tables,
      diagram boxes, captions, worked examples, recap grid, columns, grids
- [x] Reduced motion: slides change with no animation
- [x] Theme overrides from `<style id="theme">`: `--teal --or --ink --paper`, blobs, badge
- [x] Deep link to a slide (`#3` in the old file): becomes "open on slide 3" through the app

## 2. Navigation input (M3, all of it, with focus inside or outside the slide)

- [x] Next: → ↓ PageDown Space Enter. Back: ← ↑ PageUp Backspace. Home, End
- [x] F ends the show (owner's decision: a show is always full screen, so there is no windowed mode to toggle). G grid
- [x] Keys are ignored while typing in a field. Ctrl/Alt/Meta combinations don't trigger slide keys
- [x] Mouse click on a slide: next. Click in the left 12% of the stage: back. Clicks on controls don't navigate
- [ ] A click right after drawing is swallowed (350 ms) so finishing a stroke never changes slide
- [x] Finger swipe left/right: next/back. Finger swipe up: open the grid
- [x] Right-click menu of the browser never appears

## 3. Input devices: stylus, touch, mouse (M5)

- [ ] Pen always draws, even when no tool is armed. Finger navigates. Mouse draws only while a tool is armed
- [ ] Pen pressure changes stroke width, on/off per pen setting; non-pen input uses 0.5. Strokes are drawn with `perfect-freehand` (owner's decision), keeping the same size settings
- [ ] Stylus barrel button or eraser end erases, for that stroke only, then returns to the tool
- [ ] Right mouse button erases while a tool is armed
- [ ] Palm rejection: touches within 1.2 s of pen activity, or with a contact over 90×90, are ignored
- [ ] Pen tapping a control while tools are closed clicks it; dragging from it (over 9 px) draws instead; range sliders are left alone
- [ ] Coalesced and raw pointer events, so fast strokes keep every point
- [ ] Pointer capture while drawing; a lost capture ends the stroke cleanly
- [ ] Shift while drawing: straight line from the start point
- [ ] Touch on the whiteboard pans with inertia
- [ ] Low-latency pen canvas (`desynchronized`)
- [ ] Tablet mode Auto / On (default) / Off: bigger buttons, sliders and switches. Auto follows the coarse-pointer media query

## 4. Cursors (M5)

- [ ] Real OS cursor swapped for a tool-shaped image, so there is no lag: pen round dot sized to the stroke in its colour,
      highlighter translucent square sized to the marker, laser glow, eraser ring sized to the eraser
- [ ] Cursor scales with the stage and updates when colour or size changes
- [ ] Set on both `body` and `html`, so it stays while a button is held
- [ ] Used by pen hover and by mouse while a tool is armed; removed when the pointer leaves or enters the dock

## 5. Dock (M5, the minimal shell comes in M3)

- [ ] Closed: round logo. Open: logo and buttons are one capsule, no seam, no bounce, no tilt, equal frame all round
- [ ] Logo and background swap colours as it opens (see DESIGN-GLASS §8)
- [ ] Tap logo opens/closes. Drag logo moves it (over 10 px), snaps to 6 positions on release, animated glide
- [ ] Right-click or long-press (650 ms) the logo opens toolbar settings, with the 1 s guard against open-then-close
- [ ] Vertical orientation; all animations switch axis; top/bottom centre become side positions
- [ ] Auto-dim after 3.5 s idle; sink half-way into the edge after 2/4/8 s when closed; hover or touch brings it back; never sinks during a drag, popover or stroke
- [ ] Buttons: pointer, pen, highlighter, laser, eraser | undo, redo, clear, show/hide ink | board background (whiteboard only), whiteboard, grid, full screen
- [ ] Separators between groups; the colour bar under each tool shows its colour; disabled look on undo/redo/clear when nothing to do
- [ ] Dock adapts on dark cover slides (`onhero`) and dark boards (`wbdark`)
- [ ] Keyed reconcile: showing, hiding, reordering buttons animates, survives fast toggling, keeps hover and focus
- [ ] Whiteboard mode hides pointer, hide-ink and grid and shows board background, animated
- [ ] Icon swap animations; small wiggle on undo, redo, clear
- [ ] First-run hint toast; tool name toast; "Nothing to undo/redo" toasts
- [ ] Keyboard: Esc closes popover, then leaves annotation

## 6. Tools (M5)

- [ ] Tap tool: select and arm. Tap again: its settings. Double-tap (420 ms): select and settings. Right-click or long-press: settings. Each of the three is switchable
- [ ] Keys P H L E (select and arm), A toggle annotation, C clear, Ctrl+Z undo, Ctrl+Y and Ctrl+Shift+Z redo
- [ ] **Pen:** colour, width presets 4/8/15, slider 1–40, pressure toggle. Default #e5352b, 8
- [ ] **Highlighter:** presets 26/38/54, slider 10–90, strength 15–85% stored per stroke, multiply compositing, a stroke never darkens itself. Default #ffe14a, 38, 42%
- [ ] **Laser:** presets 12/18/28, slider 6–50, trail 300–4000 ms in 100 ms steps, fading trail, never stored. Default #ff2b2b, 18, 1500 ms
- [ ] **Eraser:** presets 30/50/80, slider 10–160 step 2, whole strokes by hit-testing, swept path between events. Default 50
- [ ] Colour presets: pen #e5352b #1f6fe5 #10222b #35aac5 · highlighter #ffe14a #7df09a #ff8fc8 #7fdcf0 · laser #ff2b2b #2bff6a #3d8bff #e9ece0
- [ ] Nothing is shared between tools
- [ ] Popover: live stroke preview, Reset for that tool, 4 presets, "Your colours", size presets + slider, anchored to the button, follows the dock (about 700 ms), one at a time, never covers the dock, scrolls inside instead
- [ ] Your colours: 3 saved per tool, newest first, oldest drops off
- [ ] Colour picker: separate popup beside the popover, saturation/value square, hue slider, hex field (Enter applies), "Save to my colours", live update. No eyedropper

## 7. Ink (M5)

- [ ] Strokes `{k,c,w,op,np,pts:[x,y,p]}` in stage units per slide, surviving any window size
- [ ] Separate layers for highlights and pen, highlights under pen; canvases are DPR-aware
- [ ] Per-slide undo/redo snapshots, 60 maximum; clear is undoable
- [ ] Animated removal and return: strokes fade out/in, clear is a sweep, hide ink fades with blur without deleting
- [ ] Ink follows the slide while changing slide; drawn on grid thumbnails

## 8. Grid overview (M3, ink on thumbnails in M5)

- [x] G, the dock button, or swipe up opens it. G or Esc closes. Enter or Space opens the selected slide
- [x] Arrow keys, Home, End move the selection; click a slide to open it
- [x] Real thumbnails, fully revealed; built at idle; refreshed on open if the slide changed (quiz answered, slider moved)
- [x] Field values copied into thumbnails so they match; only visible cells refresh
- [x] Slide number and `data-title` under each; selection ring
- [x] Open/close morph: the chosen thumbnail grows to the full slide with no cut
- [x] Grid always shows and returns to slides fully revealed

## 9. Whiteboard (M5, in v1 by the owner's decision)

- [ ] W opens, W or Esc closes. Circle reveal grows from the button (680 ms open, 580 ms close); instant with reduced motion
- [ ] Endless vertical scroll: wheel, ↑ ↓ PageUp PageDown Space Enter Backspace, Home to the top, touch pan with inertia, thin scroll bar
- [ ] All tools and shortcuts work; A, P, H, L, E, C, F, B behave as in the code; slide navigation is off; opening it opens the dock and arms annotation
- [ ] Remembers annotation and hide-ink state, restored on close
- [ ] Own ink and undo history (key `wb`)
- [ ] Backgrounds: Blank, Dots, Squares, Ruled lines, Graph paper. Colours: White #fcfeff, Cream #fbf5e4, Blackboard #16272f, Chalkboard #1d3b30
- [ ] B or the board button opens the picker; pattern and colour are remembered; the dock adapts on dark boards

## 10. Toolbar settings (M5, right-click or long-press the logo)

- [ ] Behaviour: start with toolbar open, auto-hide when closed, hide after 2/4/8 s, starting tool
- [ ] Layout: horizontal/vertical, 6-position grid (centres disabled when vertical)
- [ ] Touch: tablet mode
- [ ] Tool gestures: tap again, double-tap, right-click (long-press on touch)
- [ ] Buttons: list with move up, move down, show/hide
- [ ] Settings file: Export and Import JSON (`{v:1,ui,tools}`), compatible with files from the template
- [ ] Reset all
- [ ] Apply and save instantly. Validate on load (`fixAll`): drop unknown ids, append missing ones, clamp numbers, check hex colours, cap custom colours at 3, no centre position when vertical
- [ ] `LOP_DEFAULTS` idea: shipped defaults, carried over as the app's own defaults

## 11. Motion rules

- [ ] One body, no bounce, one shared timing for the dock (HANDOFF §3.10)
- [ ] Reduced motion makes dock, ink, grid and whiteboard changes instant
