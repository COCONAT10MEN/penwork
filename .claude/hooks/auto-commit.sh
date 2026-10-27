#!/usr/bin/env bash
# Stop hook: after each Claude turn, commit any leftover changes and push to origin.
# Safety net only; Claude still makes its own descriptive commits (see CLAUDE.md).
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "chore: auto-save progress ($(date '+%Y-%m-%d %H:%M'))" || exit 0
fi

# Push only if there is an upstream and something to push. Never force.
git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1 || exit 0
if [ -n "$(git log '@{u}..HEAD' --oneline 2>/dev/null)" ]; then
  if ! out=$(git push -q 2>&1); then
    msg=$(printf '%s' "$out" | tr '\n"' "  " | cut -c1-200)
    printf '{"systemMessage":"Auto-push failed: %s"}\n' "$msg"
  fi
fi
exit 0
