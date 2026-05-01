#!/bin/bash
# Session start hook — loads project context into the Claude session
# This script runs automatically when a new Claude Code session starts.
# Its stdout is injected into the conversation as context.

echo "## Session Context"
echo ""

# Recent git activity
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "### Recent Commits"
  echo '```'
  git log --oneline -10 2>/dev/null || echo "No commits yet"
  echo '```'
  echo ""

  # Current branch and status
  echo "### Current State"
  echo "- Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
  CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  echo "- Uncommitted changes: $CHANGES files"
  echo ""
fi

# Recent decisions
if [ -d "docs/decisions" ]; then
  DECISION_COUNT=$(find docs/decisions -name "*.md" -not -name "gotchas.md" -not -name ".gitkeep" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$DECISION_COUNT" -gt 0 ]; then
    echo "### Recent Decisions"
    # Show the 3 most recent decision files
    find docs/decisions -name "*.md" -not -name "gotchas.md" -not -name ".gitkeep" -print0 2>/dev/null | \
      xargs -0 ls -t 2>/dev/null | head -3 | while read -r file; do
        TITLE=$(head -1 "$file" | sed 's/^# //')
        echo "- $TITLE"
      done
    echo ""
  fi

  # Gotchas
  if [ -f "docs/decisions/gotchas.md" ]; then
    GOTCHA_COUNT=$(grep -c "^- " docs/decisions/gotchas.md 2>/dev/null || echo 0)
    if [ "$GOTCHA_COUNT" -gt 0 ]; then
      echo "### Gotchas ($GOTCHA_COUNT known)"
      echo "See docs/decisions/gotchas.md before making changes."
      echo ""
    fi
  fi
fi

# Progress tracking (internal)
if [ -f "docs/progress/current.md" ]; then
  # Count in-progress tasks (table rows excluding header and separator)
  IN_PROGRESS=$(sed -n '/^## In Progress/,/^##/p' docs/progress/current.md 2>/dev/null | grep "^|" | grep -v "^| Task" | grep -v "^|--" | wc -l | tr -d ' ')
  if [ "$IN_PROGRESS" -gt 0 ]; then
    echo "### Progress Tracking"
    echo "- Active tasks: $IN_PROGRESS (see docs/progress/current.md)"

    # Check for blockers
    BLOCKER_COUNT=$(sed -n '/^## Blockers/,/^##/p' docs/progress/current.md 2>/dev/null | grep "^|" | grep -v "^| Blocker" | grep -v "^|--" | wc -l | tr -d ' ')
    if [ "$BLOCKER_COUNT" -gt 0 ]; then
      echo "- **$BLOCKER_COUNT blocker(s)** — check docs/progress/current.md"
    fi
    echo ""
  fi
fi
