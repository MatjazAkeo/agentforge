#!/bin/bash
# Pre-commit hook — redirects to /commit for orchestrated workflow
#
# This hook intercepts raw `git commit` commands and suggests using
# the /commit slash command instead, which chains:
# review → learn → progress update → commit
#
# The hook receives tool input as JSON on stdin.
# Exit 0 = allow, Exit 2 = block with message.

INPUT=$(cat)

# Extract the command — use jq if available, fallback to grep
if command -v jq &> /dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.command // empty' 2>/dev/null)
else
  COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"command"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# Only act on git commit commands
if echo "$COMMAND" | grep -q "git commit"; then
  # Allow if running from the /commit flow (env var bypass)
  if echo "$COMMAND" | grep -q "CLAUDE_COMMIT_FLOW=1"; then
    exit 0
  fi

  # Check if there are staged changes
  STAGED=$(git diff --cached --name-only 2>/dev/null)
  if [ -z "$STAGED" ]; then
    exit 0  # No staged changes, let git handle the error
  fi

  # Block and redirect to /commit
  echo "Use /commit instead of raw git commit."
  echo ""
  echo "The /commit command runs an orchestrated workflow:"
  echo "  1. Reviews staged changes against team standards"
  echo "  2. Captures learnings (decisions, gotchas, patterns)"
  echo "  3. Updates progress tracking (if configured)"
  echo "  4. Commits with a proper message"
  echo ""
  echo "Staged files:"
  echo "$STAGED" | while read -r file; do
    echo "  - $file"
  done
  echo ""
  echo "Run /commit now, or /commit quick to skip the review."
  exit 2
fi

# Not a git commit command — pass through
exit 0
