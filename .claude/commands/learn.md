---
description: Capture learnings from the current session — decisions, gotchas, patterns, or new commands.
---

# Learn — Post-Task Knowledge Capture

After completing a task, evaluate what was learned and capture useful knowledge for the project.

## Usage
- `/learn` — review recent work and suggest learnings to capture

## Behavior

1. **Review recent work:**
   - Run `git diff HEAD~3` to see recent changes
   - Consider the conversation context — what problems were solved?

2. **Identify learnings** in these categories:

   **Decisions** — Was an architectural or convention choice made?
   - Example: "Chose Zustand over Redux because the app only needs simple global state"
   - Action: Create `docs/decisions/YYYY-MM-DD-<topic>.md`

   **Gotchas** — Was a non-obvious bug or quirk discovered?
   - Example: "Supabase RLS policies don't apply to service_role key"
   - Action: Append to `docs/decisions/gotchas.md`

   **Patterns** — Was a reusable pattern established that should be followed?
   - Example: "All API routes now use a shared error handler wrapper"
   - Action: Propose update to CLAUDE.md coding standards

   **Commands** — Was a multi-step workflow repeated that could become a reusable command?
   - Example: "I keep running the same 5 steps to set up a new API route"
   - Action: Create a slash command (and optionally an agent) as a new skill

   When proposing a new command, present it as:
   > **Proposed Command:** `/<command-name>`
   > **Description:** [what it does]
   > **Trigger pattern:** [what repeated workflow was observed]
   > **Files to create:**
   > - `.claude/commands/<command-name>.md` — [brief description]
   > - `.claude/agents/<command-name>.md` — [if complex enough to need an agent]
   >
   > **Command content:**
   > [show the full markdown for the command file]
   >
   > **Agent content:** (if applicable)
   > [show the full markdown for the agent file]

   A command only needs an agent if:
   - It involves complex multi-step analysis (like standards-checker)
   - It needs a distinct persona or specialized behavior
   - The command alone would be too long/complex without delegation

   Simple workflows (scaffolding a file, running a sequence) only need a command.

3. **Present findings** to the user:
> "Here's what I think is worth capturing from this session:
>
> **Decision:** [description]
> **Gotcha:** [description]
>
> Should I save these? You can approve, modify, or skip each one."

4. **Write only after approval.** Use the correct format for each type:
   - Decisions: full ADR format in `docs/decisions/`
   - Gotchas: one-line append to `docs/decisions/gotchas.md`
   - Patterns: targeted edit to CLAUDE.md
   - Commands: new command in `.claude/commands/` and optionally agent in `.claude/agents/`

5. **If nothing worth capturing**, say so:
> "No significant learnings from this session — the work followed established patterns."
