# First prompts to paste into Claude Code

## Session 1 — scaffold (M0)

```
/milestone 0
```

Extra context for M0 if it asks how to scaffold:

```
Scaffold with create-tauri-app (React + TypeScript template, npm). Run it into a temporary
folder first (check `npm create tauri-app@latest -- --help` for the non-interactive flags),
then move the generated files into this repo root WITHOUT overwriting CLAUDE.md, docs/,
design/, .claude/, README.md, SETUP-WINDOWS.md, KICKOFF.md or THIRD_PARTY.md. Merge .gitignore.
Then delete the temporary folder.
```

When it's done you should be able to run `npm run tauri dev` and see an empty Penwork window.

## Session 2 — theme + components (M1)

Type `/clear` first, then:

```
/milestone 1
Start with theme generation and the motion presets, then build the components in this order:
Button, IconButton, ButtonGroup, FAB + FAB menu, FloatingToolbar, Chip, SearchBar, NavigationRail,
Card, SideSheet, Slider, Switch, Snackbar + wavy progress. Show each one on the Gallery screen.
```

## Session 3 onward

`/clear`, then `/milestone 2`, `/milestone 3`, …

## Good habits to paste when needed

- "Before changing anything, explain the plan in 5 bullet points."
- "Use the ui-reviewer agent on what you just built and fix the Must-fix items."
- "That broke X. Find the cause before fixing — don't guess."
- "Write a test for that bug first, then fix it."
