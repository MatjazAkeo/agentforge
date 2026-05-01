#!/bin/bash
# Enhanced statusline for Claude Code
# Reads JSON from stdin, outputs a formatted status line

input=$(cat)

# Extract fields using jq
MODEL=$(echo "$input" | jq -r '.model.display_name // "unknown"')
DIR=$(echo "$input" | jq -r '.workspace.current_dir // ""')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
LINES_ADDED=$(echo "$input" | jq -r '.cost.total_lines_added // 0')
LINES_REMOVED=$(echo "$input" | jq -r '.cost.total_lines_removed // 0')
RATE_5H=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty' 2>/dev/null | cut -d. -f1)
WORKTREE=$(echo "$input" | jq -r '.worktree.name // empty' 2>/dev/null)
EFFORT=$(jq -r '.effortLevel // "high"' ~/.claude/settings.json 2>/dev/null)

# Get git branch (fast, no subshell overhead)
BRANCH=""
if [ -d "${DIR}/.git" ] || git -C "$DIR" rev-parse --git-dir > /dev/null 2>&1; then
  BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null)
fi

# Context percentage with color coding
# ANSI: green=32, yellow=33, red=31
if [ "$PCT" -ge 80 ]; then
  CTX="\033[31m${PCT}% ctx\033[0m"
elif [ "$PCT" -ge 50 ]; then
  CTX="\033[33m${PCT}% ctx\033[0m"
else
  CTX="\033[32m${PCT}% ctx\033[0m"
fi

# Build the status line
STATUS="[${MODEL}|${EFFORT}]"

# Directory + branch or worktree
FOLDER="${DIR##*/}"
if [ -n "$WORKTREE" ]; then
  STATUS="${STATUS} ${FOLDER} 🌿 ${WORKTREE}"
elif [ -n "$BRANCH" ]; then
  STATUS="${STATUS} ${FOLDER} (${BRANCH})"
else
  STATUS="${STATUS} ${FOLDER}"
fi

# Context
STATUS="${STATUS} | ${CTX}"

# Lines changed (only show if there are changes)
if [ "$LINES_ADDED" -gt 0 ] || [ "$LINES_REMOVED" -gt 0 ]; then
  STATUS="${STATUS} | +${LINES_ADDED}/-${LINES_REMOVED}"
fi

# Rate limit (only show if available)
if [ -n "$RATE_5H" ]; then
  if [ "$RATE_5H" -ge 80 ]; then
    STATUS="${STATUS} | rate: \033[31m${RATE_5H}%\033[0m"
  elif [ "$RATE_5H" -ge 50 ]; then
    STATUS="${STATUS} | rate: \033[33m${RATE_5H}%\033[0m"
  else
    STATUS="${STATUS} | rate: ${RATE_5H}%"
  fi
fi

echo -e "$STATUS"
