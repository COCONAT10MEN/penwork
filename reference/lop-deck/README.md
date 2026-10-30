# Penwork handoff — annotation toolbar

Give this whole folder (or zip) to the AI that builds Penwork, then tell it:

> Read HANDOFF.md first (section 11 has the exact prompt). Don't start coding until I approve its proposal.

* `HANDOFF.md` — the full brief: what the toolbar is, how it behaves, how it could map onto Penwork, what to leave out, open decisions.
* `reference/deck-template.html` — working demo; double-click it in Chrome/Edge, tap the logo at the bottom.
* `reference/screenshots/` — 10 screenshots at 1366×768.
* `reference/source/` — the real code (plain JS + CSS), as an executable specification.
* `reference/settings-example.json` — the settings the toolbar saves.
* `reference/presentation-template/` — the original slide-template package this came from (context only).

Penwork only opens PDFs. Nothing here should make it load or present HTML decks.
No secrets, .env files or credentials are included.
