---
description: Smart commit — reviews, learns, updates progress, then commits. Use this instead of raw git commit.
---

# Commit — Orchestrated Commit Workflow

A smart commit flow that ensures quality gates are met before committing.

## Usage
- `/commit` — review staged changes, learn, update progress, and commit
- `/commit quick` — skip review, just learn + update progress + commit (for trivial changes)
- `/commit message: <msg>` — use a specific commit message instead of auto-generating

## Behavior

### Step 1: Pre-flight Checks

1. Run `git diff --cached --name-only` to see staged changes
2. If nothing is staged:
   - Run `git diff --name-only` to check for unstaged changes
   - If unstaged changes exist, ask: "Nothing staged. Want me to stage all changes, or specific files?"
   - If no changes at all, say: "Nothing to commit." and stop.

### Step 2: Review (unless `quick` mode)

1. Run `git diff --cached` to get the full staged diff
2. Read CLAUDE.md for project standards
3. Perform a standards check (same logic as the `standards-checker` agent):
   - Check for MUST FIX violations
   - Check for security concerns (hardcoded secrets, credentials in diff)
   - Check for SHOULD FIX items
4. Present findings:
   - If MUST FIX issues exist: show them and ask "Fix these before committing? (yes/no/skip)"
     - If yes: fix them, re-stage, and re-run review
     - If skip: proceed with a warning
   - If only SHOULD FIX/CONSIDER: show them as informational, proceed
   - If no issues: say "Review passed. No issues found."

### Step 3: Learn

1. Review the staged diff and conversation context
2. Identify any learnings (same categories as `/learn`):
   - Decisions, Gotchas, Patterns, Commands
3. If learnings are found, present them briefly:
> "I noticed these potential learnings:
> - **Gotcha:** [description]
> - **Pattern:** [description]
>
> Save these? (yes/no/modify) — I'll save after the commit completes."
4. Remember the user's choices for Step 6
5. If no learnings: skip silently (don't ask)

### Step 4: Update Progress (if `docs/progress/current.md` exists)

1. Read `docs/progress/current.md`
2. Based on the diff, determine if any in-progress tasks appear to be completed or advanced
3. If matches found, propose updates:
> "Based on this commit, it looks like [task] might be done. Should I:
> (a) Move it to completed
> (b) Update its notes
> (c) Leave progress as-is"
4. Remember choices for Step 6
5. If no progress file exists or no matches: skip silently

### Step 4b: Update Documentation & Plan

1. **Determine the current feature** from the branch name (e.g., `feat/user-auth` → `user-auth`)

2. **Update implementation plan** (if `docs/plans/<feature-name>-plan.md` exists):
   - Analyze the diff to determine which plan steps were addressed by this commit
   - Mark completed steps as `[x]` in the plan file
   - Present: "Marked these plan steps as complete: [list]. OK?"

3. **Update or create feature documentation:**
   - Check if `docs/documentation/<feature-name>.md` exists
   - **If it exists:** check if changes in the diff make it stale, offer to update:
     > "(a) Update docs now (I'll generate updates for review)
     > (b) Skip — docs are still accurate"
   - **If it does NOT exist:** create it with content based on the diff:
     - Feature title (from branch name)
     - What was implemented (from diff analysis)
     - Key files and their purpose
     - Usage examples if applicable
     - Present for review before writing

4. Remember choices for Step 6

### Step 5: Commit

1. Generate a commit message based on the diff:
   - Follow the commit format from CLAUDE.md (conventional commits, ticket prefix, or free-form)
   - Keep it concise (under 72 chars for subject line)
   - Do NOT add Co-Authored-By trailers
2. If the user provided a message via `/commit message: <msg>`, use that instead
3. Present the message: "Proposed commit message: `[message]` — OK? (yes/edit)"
4. Execute: `CLAUDE_COMMIT_FLOW=1 git commit -m "[message]"`

### Step 6: Post-Commit Housekeeping

After a successful commit:

1. If learnings were approved in Step 3, write them now:
   - Decisions → `docs/decisions/YYYY-MM-DD-<topic>.md`
   - Gotchas → append to `docs/decisions/gotchas.md`
   - Patterns → propose CLAUDE.md update (ask before editing)
   - Skills → create files in `.claude/commands/` and optionally `.claude/agents/`

2. If documentation/plan updates were approved in Step 4b:
   - Update plan checkboxes in `docs/plans/<feature-name>-plan.md`
   - Write new or updated doc files to `docs/documentation/`

3. If progress updates were approved in Step 4:
   - Update `docs/progress/current.md` (move tasks, update notes)
   - Append to `docs/progress/completed.md` if tasks were completed

4. If any post-commit files were written, stage and amend:
   - `CLAUDE_COMMIT_FLOW=1 git add docs/progress/ docs/plans/ docs/decisions/ docs/documentation/ .claude/commands/ .claude/agents/`
   - `CLAUDE_COMMIT_FLOW=1 git commit --amend --no-edit`

### Error Handling

- If the commit fails (hook error, etc.), show the error and offer to fix
- If the review found CRITICAL security issues (secrets in code), BLOCK the commit and explain why
- If `git commit` returns non-zero, do NOT proceed to post-commit housekeeping
