# Setting up your Windows laptop for Penwork

Do these once, in order. Restart the terminal after each install so new commands are found.

## 1. Install the tools

| Tool | How | Check it worked |
|---|---|---|
| **Git for Windows** | Download from https://git-scm.com/downloads/win, keep the default options | `git --version` |
| **Node.js LTS** | Download the LTS installer from https://nodejs.org | `node -v` and `npm -v` |
| **Microsoft C++ Build Tools** | Download "Build Tools for Visual Studio", and in the installer tick **Desktop development with C++** | (no command; needed by Rust) |
| **Rust** | Download `rustup-init.exe` from https://rustup.rs and accept the defaults (MSVC toolchain) | `rustc --version` and `cargo --version` |
| **WebView2** | Already built into Windows 10 (1803+) and 11 — nothing to do | |

If Rust was already installed before, run `rustup default stable-msvc` once.

Git for Windows matters for Claude Code too: with it, Claude Code can use its Bash tool;
without it, it falls back to PowerShell.

## 2. Install Claude Code

Open **PowerShell** (the prompt starts with `PS C:\`) and run:

```powershell
irm https://claude.ai/install.ps1 | iex
```

Open a **new** terminal and check:

```powershell
claude --version
```

If it says `claude` isn't recognized, the install folder isn't on your PATH yet — see
https://code.claude.com/docs/en/troubleshoot-install.md

## 3. Put the project somewhere simple

Unzip this folder to a short path without spaces, for example:

```
C:\dev\penwork
```

## 4. Start Claude Code in the project

```powershell
cd C:\dev\penwork
claude
```

The first time, it opens your browser to sign in with your Claude account (Pro works).
You don't need to run `/init` — `CLAUDE.md` is already written.

## 5. Kick off

Paste the first prompt from `KICKOFF.md`.

## Handy things inside Claude Code

| Type this | What it does |
|---|---|
| `/milestone 0` | Works on a roadmap milestone (plan first, then builds, tests, commits) |
| `/check` | Runs typecheck, lint, tests and cargo check, and fixes failures |
| `Shift + Tab` | Switches permission mode (e.g. plan mode, where Claude only plans and doesn't edit) |
| `/clear` | Start fresh when a conversation gets long (do this between milestones) |
| `claude -c` | (in the terminal) continue the last conversation in this folder |
| "use the ui-reviewer agent to review the toolbar" | Gets a design/accessibility review of UI work |

## Tips

- One milestone per conversation, then `/clear`. Long conversations get sloppy.
- When Claude says something is done, actually click through it in the app window. If it's wrong,
  describe exactly what you see ("the toolbar covers the page number at 150% zoom").
- If you ever want to undo a bad change: "undo your last commit" or use `git log` to find a good point.
- Back up to GitHub: ask Claude "create a private GitHub repo for this project and push it"
  (it'll ask you to log in with `gh auth login` first).
