---
description: Plan a new feature — creates branch, documents in progress, scaffolds docs, plans implementation. WAIT for CONFIRM before coding.
---

# Plan — New Feature Workflow

Take an approved design (from `/brainstorming`) and turn it into an implementation plan with branching, progress tracking, and documentation.

## Usage
- `/plan <description>` — plan a new feature (after brainstorming)

## Behavior

### Step 1: Reference the Brainstorming Output

The user should have run `/brainstorming` first (from the superpowers plugin). Read the most recent design decisions from the conversation context or from a spec if one was written.

If no brainstorming has been done for this feature and the scope isn't obvious, tell the user:
> "Let's brainstorm this first — run `/brainstorming <your idea>`, then come back to `/plan`."

For simple/obvious features (typo fix, small tweak), you can skip brainstorming and proceed directly.

### Step 2: Understand the Feature

1. Restate the requirements in clear terms
2. Identify affected files and components
3. Assess complexity:
   > (a) Low — single file, straightforward change
   > (b) Medium — multiple files, some coordination needed
   > (c) High — architectural change, many files, risk of breakage
4. Identify risks and dependencies

### Step 3: Create Branch

1. Generate a branch name from the feature description: `feat/<short-description>`
   - Use kebab-case, max 3-4 words (e.g., `feat/user-auth`, `feat/dashboard-charts`)
2. Confirm:
   > "I'll create branch `feat/<name>`. OK?
   > (a) Yes
   > (b) Use a different name"
3. Execute: `git checkout -b feat/<name>`

### Step 4: Document in Progress

Add the feature to `docs/progress/current.md` under "In Progress":

```
| <feature description> | <user> | <today's date> | Complexity: <level> |
```

### Step 5: Scaffold Documentation

Create `docs/documentation/<feature-name>.md` with:

```markdown
# <Feature Title>

## Description
<description from Step 1>

## Status
In Progress

## Architecture Decisions
_To be filled during implementation_

## API / Component Reference
_To be filled during implementation_

## Usage Examples
_To be filled during implementation_
```

### Step 6: Present Implementation Plan

1. Break down into phases with specific, actionable steps
2. Identify dependencies between phases
3. List files to create/modify per phase
4. For each step, include a checkbox: `- [ ] Step description`
5. Present the plan and WAIT for explicit confirmation:
   > "Here's the implementation plan. Proceed?
   > (a) Yes — start implementing
   > (b) Modify — tell me what to change
   > (c) Cancel — discard the plan"

**CRITICAL**: Do NOT write any implementation code until the user confirms with (a).

### Step 7: Save Implementation Plan

After user confirms:

1. Save the full plan to `docs/plans/<feature-name>-plan.md`:

```markdown
# Implementation Plan: <Feature Title>

**Branch:** `feat/<name>`
**Complexity:** <level>
**Created:** <today's date>

## Requirements
<restated requirements from Step 1>

## Risks & Dependencies
<from Step 1>

## Implementation Phases

### Phase 1: <name>
- [ ] <step 1>
- [ ] <step 2>
- [ ] <step 3>

### Phase 2: <name>
- [ ] <step 1>
- [ ] <step 2>

## Files to Create/Modify
- `path/to/file.ts` — <what changes>
- `path/to/new-file.ts` — <what it does>
```

2. Commit the scaffolding (branch, progress, docs, plan):
   `CLAUDE_COMMIT_FLOW=1 git add docs/ && CLAUDE_COMMIT_FLOW=1 git commit -m "docs: plan <feature-name>"`

### Step 8: Offer Execution Approach

After saving the plan, ask the user how they want to execute it:

> "Plan saved to `docs/plans/<feature-name>-plan.md`. How would you like to execute it?
>
> (a) **Subagent-driven (recommended)** — I dispatch a fresh subagent per task with automatic review between tasks. Fast iteration, cleaner context.
> (b) **Inline execution** — I implement tasks sequentially in this session with checkpoints for your review.
> (c) **I'll do it myself** — just leave the plan for reference."

Based on the answer:

- **If (a):** Invoke the `superpowers:subagent-driven-development` skill with the plan path as argument.
- **If (b):** Invoke the `superpowers:executing-plans` skill with the plan path.
- **If (c):** Stop here. The user will work through the plan manually. Remind them: "Use `/commit` after each logical chunk — it updates progress, docs, and plan checkboxes automatically."
