---
name: check
description: Run every project check (typecheck, lint, unit tests, cargo check) and fix what fails. Use before saying any task is done.
---

Run these from the repo root and report a one-line result for each:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `cargo check` inside `src-tauri/`

If something fails, fix the cause (don't disable the rule or skip the test) and run the checks again.
If a script doesn't exist yet (early milestones), say so instead of failing.
Finish with a short summary: all green, or what still fails and why.
