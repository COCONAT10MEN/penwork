# Prompts for Claude Code

## 1. Finish M1 with the glass kit

```
/milestone 1
Finish M1 as docs/ROADMAP.md describes it: the Surface primitive and glass tokens first,
then give the existing components the material prop, then the remaining components
(ColorPicker, TextField and Breadcrumb included), the cookie logo and the ambient background.
Match design/mockups/v2/material.html. Show everything in the Gallery over the ambient
background, in glass and tonal, light and dark. Test the popovers in the real Tauri window,
not only the browser. Measure frames per second when opening the FloatingToolbar, and GPU
load at idle, and report both.
```

## 2. Then M2 (Home + opening decks), M3 (Present), M4 (mini edits), M5 (dock, ink, whiteboard)

```
/milestone 2
```
For each later milestone, just `/milestone <n>`. Say "Part 1 works, continue" between parts.
If it starts forgetting things, type `/compact`.

## 3. Making decks with Claude chat (once M4's AI kit exists)

In Penwork: Settings → "Get the AI kit". Attach the kit to a Claude chat with your lesson material, then
paste the prompt from `authoring/PROMPT.md`. Until then, use the old template's prompt
(`reference/lop-deck/presentation-template/AI-GUIDE.md` §1). Penwork's importer reads those `.html` decks too.

## Good habits to paste when needed

- "Before changing anything, explain the plan in 5 bullet points."
- "Use the ui-reviewer agent on what you just built and fix the Must-fix items."
- "That broke X. Find the cause before fixing — don't guess."
- "Write a test for that bug first, then fix it."
