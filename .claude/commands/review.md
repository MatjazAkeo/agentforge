---
description: Review current changes against team coding standards defined in CLAUDE.md.
---

# Code Review

Review your current changes against the team's coding standards.

## Usage
- `/review` — review all uncommitted changes
- `/review staged` — review only staged changes
- `/review <path>` — review changes in a specific file

## Behavior

1. **Read CLAUDE.md** for the project's coding standards, conventions, and rules

2. **Get the diff:**
   - Default: `git diff` (all uncommitted changes)
   - If `staged`: `git diff --cached`
   - If path given: `git diff -- <path>`

3. **Dispatch the `standards-checker` agent** with the diff and CLAUDE.md rules

4. **Present findings** grouped by severity:
   - **MUST FIX** — Direct violations of team standards from CLAUDE.md
   - **SHOULD FIX** — Improvements that align with conventions
   - **CONSIDER** — Optional suggestions for better code

5. **Offer to auto-fix** MUST FIX items if they are mechanical (import ordering, naming conventions)

## What This Checks (Beyond Linters)

This review focuses on **semantic rules** that ESLint/Prettier can't catch:
- Architecture patterns (is this code in the right directory?)
- Naming conventions from CLAUDE.md
- Test coverage requirements (is a test missing?)
- Documentation requirements (should docs be updated?)
- Task tracking compliance (is a ticket ID referenced?)
- Security concerns (OWASP top 10 patterns)
