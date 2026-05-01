---
description: Bootstrap or update this project's Claude Code configuration. Detects stack, asks questions, generates CLAUDE.md + settings.
---

# Init Project

You are setting up Claude Code for this project. Follow this process exactly.

## Step 1: Detect Mode

Check if `.claude/CLAUDE.md` has meaningful content (not just placeholders with `{curly_braces}`).

- **If empty or only placeholders** → run Init Mode (Step 2)
- **If has real content** → run Update Mode (Step 8)

## Step 2: Auto-Detection (Init Mode)

Scan the project root for these files and report what you find:

**Framework detection:**
- `next.config.*` → Next.js
- `nuxt.config.*` → Nuxt
- `vite.config.*` → Vite (check for React/Vue/Svelte plugin)
- `svelte.config.*` → SvelteKit
- `wp-content/` or `style.css` with `Theme Name:` → WordPress
- `angular.json` → Angular

**Language detection:**
- `tsconfig.json` → TypeScript (check `strict` setting)
- `composer.json` → PHP (check version constraint)
- `package.json` → JavaScript/Node.js

**Styling detection:**
- `tailwind.config.*` → Tailwind CSS
- `postcss.config.*` without Tailwind → PostCSS/CSS Modules
- `.scss` files or `sass` in dependencies → SCSS

**Database detection:**
- `supabase/` directory or `@supabase/supabase-js` in dependencies → Supabase
- `firebase.json` or `firebase` in dependencies → Firebase
- `prisma/` directory → Prisma (check `datasource` for DB type)
- `wp-config.php` → MySQL (WordPress)

**Testing detection:**
- `vitest.config.*` or `vitest` in devDependencies → Vitest
- `jest.config.*` or `jest` in devDependencies → Jest
- `cypress/` or `cypress` in devDependencies → Cypress
- `playwright.config.*` → Playwright
- `phpunit.xml` → PHPUnit

**Package manager:** Always npm (skip detection).

**CI/CD:** Asked in Question 6b (not auto-detected).

**Linting detection:**
- `.eslintrc.*` or `eslint.config.*` or `eslintConfig` in package.json → ESLint (note config style)
- `.prettierrc.*` or `prettier` in package.json → Prettier
- `biome.json` → Biome

**Security detection:**
- `middleware.ts` or `middleware.js` at root → Next.js middleware (check what it protects)
- `helmet` in dependencies → Security headers configured
- `csurf` or `csrf` in dependencies → CSRF protection
- `supabase/` directory → Check for RLS policies
- `firebase.json` or `firestore.rules` → Check for security rules
- `.env.example` exists → Secrets management in place
- `next.config.*` with `headers` → Security headers configured

**Monorepo check:**
If you detect multiple conflicting frameworks (e.g., both `next.config.js` and `wp-content/`), ask:
> "I see both [X] and [Y]. Is this a monorepo? Which part should I configure for?"

Then scope to the user's choice.

## Step 3: Present Findings & Ask Questions

Present what you detected, then ask the following questions **one at a time**. Wait for each answer before asking the next.

### Question 1: Project Identity
> "I detected: [summary of findings]. What's this project?
> (a) Web application (SaaS, dashboard, portal)
> (b) Marketing/landing site
> (c) E-commerce
> (d) Blog/content site
> (e) API/backend service
> (f) WordPress theme/plugin
>
> Give me a one-liner description:"

### Question 2: Stack Confirmation
> "Here's the stack I detected:
> - Framework: [X]
> - Language: [X]
> - Styling: [X]
> - Database: [X]
> - Testing: [X]
> - Package Manager: npm
>
> Is this correct?
> (a) Yes, looks good
> (b) Need to adjust — [let me describe changes]"

### Question 3: Coding Conventions

If a linter was detected:
> "I found [linter config]. Select any additional coding rules Claude should follow (select multiple):
> (a) Functional components only — use React hooks, no class components
> (b) Named exports preferred — use `export function Foo` instead of `export default`
> (c) Strict TypeScript — no `any` type, no `as` type assertions, use proper generics
> (d) Zod validation — validate all API inputs/outputs with Zod schemas at boundaries
> (e) None beyond the linter — rely on ESLint/Prettier config only"

If NO linter was detected:
> "No linting setup found. I'll configure ESLint + Prettier for you.
> Which coding rules should be enforced? (select multiple):
> (a) Functional components only — use React hooks, no class components
> (b) Named exports preferred — use `export function Foo` instead of `export default`
> (c) Strict TypeScript — no `any` type, no `as` type assertions, use proper generics
> (d) Zod validation — validate all API inputs/outputs with Zod schemas at boundaries
> (e) Minimal rules only — just basic formatting with Prettier"

Then generate the linter config:
- Create `.eslintrc.json` with rules matching the selected options
- Create `.prettierrc` with sensible defaults (semi, singleQuote, printWidth: 100)
- Add `eslint` and `prettier` to devDependencies in `package.json` (create if needed)
- Add lint scripts: `"lint": "eslint .", "format": "prettier --write ."`
- Run `npm install` to install the linting dependencies

### Question 4: File/Folder Conventions
Show the detected folder structure and ask:
> "Here's what I see for your project structure:
> [list detected directories with descriptions]
>
> (a) Looks correct
> (b) Need to adjust — [let me describe changes]"

### Question 5: Testing Expectations
If no testing framework was detected, recommend Playwright:
> "I didn't detect a testing framework. I'd recommend **Playwright** — it handles unit tests, integration tests, and end-to-end browser testing in one tool. Want to use it? (yes/no/other)"

If a testing framework was detected:
> "I found [testing framework]. What should have tests?
> (a) Everything — all code must have tests
> (b) Business logic only — src/lib/ and services
> (c) Critical paths — auth, payments, data mutations
> (d) Tests are optional — write them when useful"

### Question 6: Git Workflow
Branch naming and commit format are hardcoded — skip these questions.
- **Branches:** `feat/description` (short prefix style)
- **Commits:** Conventional commits — `type(scope): description`

Only ask about PR process:
> "PR review process:
> (a) Require 1 review before merge
> (b) Require 2 reviews
> (c) No formal review process"

### Question 6b: CI/CD
> "CI/CD setup? (select all that apply)
> (a) GitHub Actions — automated workflows in `.github/workflows/`
> (b) Custom shell scripts — manual deploy/build scripts
> (c) None — no CI/CD configured"

### Question 7: Task Tracking
Always use internal progress tracking (`docs/progress/`). Skip this question — hardcoded.
Step 4b will always create the progress tracking files.

When generating CLAUDE.md, set:
- Project docs live in `docs/documentation/`
- Use separate markdown files per topic
- Update relevant docs when changing public APIs or architecture

### Question 9: Autonomy Level
> "How autonomous should Claude be in this project?
> (a) **Conservative** — Always ask before writing files, running commands, or making changes. Read-only operations are fine.
> (b) **Balanced** — Run safe operations freely (read, search, lint, test). Ask before writing files, committing, or running destructive commands.
> (c) **Autonomous** — Act freely on all operations. Only ask before pushing, deploying, or making irreversible changes."

### Question 10: Permission Level
Based on the autonomy answer, propose a specific permissions list:

**If Conservative:**
> "Based on your choice, I'll set these permissions:
> - Allow: Read, Grep, Glob (read-only tools)
> - Everything else will prompt for approval
> Does this look right?"

**If Balanced:**
> "Based on your choice, I'll set these permissions:
> - Allow: Read, Grep, Glob, Write, Edit, WebFetch, WebSearch
> - Allow Bash: git status, git diff, git log, git add, [package manager] run, tsc --noEmit
> - [Stack-specific]: [firebase/supabase/wp commands if detected]
> - Everything else will prompt for approval
> Does this look right?"

**If Autonomous:**
> "Based on your choice, I'll set these permissions:
> - Allow: Read, Grep, Glob, Write, Edit, WebFetch, WebSearch
> - Allow Bash: git status, git diff, git log, git add, git commit, [package manager] *, npm install, tsc --noEmit
> - [Stack-specific]: [firebase/supabase/wp commands if detected]
> - Still prompts for: git push, destructive commands
> Does this look right?"

### Question 11: Security Basics
> "A few quick security questions:
>
> Auth provider:
> (a) Supabase Auth
> (b) Firebase Auth
> (c) NextAuth / Auth.js
> (d) WordPress built-in
> (e) Custom / other
> (f) None yet
>
> Where are security headers configured?
> (a) next.config.js / nuxt.config.ts
> (b) Vercel/Netlify config
> (c) Middleware (helmet, etc.)
> (d) .htaccess / server config
> (e) Not configured yet
> (f) Not sure"

Use the answers to populate the `## Security` section in CLAUDE.md.

## Step 4: Generate CLAUDE.md

Using the answers from Step 3, generate the CLAUDE.md file. Replace all `{placeholder}` values with real content.

Write the file to `.claude/CLAUDE.md`.

## Step 4b: Set Up Internal Progress Tracking

Always create the internal progress tracking system:

1. Create `docs/progress/` directory
2. Create `docs/progress/current.md` with this template:

```markdown
# Current Tasks

Tasks currently in progress. Update this file when starting or completing work.

## In Progress

| Task | Owner | Started | Notes |
|------|-------|---------|-------|

## Up Next

- [ ] _Add your upcoming tasks here_

## Blockers

| Blocker | Affects | Raised | Status |
|---------|---------|--------|--------|
```

3. Create `docs/progress/completed.md` with this template:

```markdown
# Completed Tasks

Archive of completed work. Move tasks here from `current.md` when done.

## Completed

| Task | Completed | Notes |
|------|-----------|-------|
```

4. Set CLAUDE.md Task Tracking section to:
   - **System:** Internal (docs/progress/)
   - **Project:** See `docs/progress/current.md` for active tasks
   - Update progress when starting or completing tasks.

## Step 5: Generate settings.json

Build the settings.json based on:
- Permission level from Question 10
- Detected plugins:
  - Always: `superpowers@claude-plugins-official`, `context7@claude-plugins-official`, `figma@claude-plugins-official`
  - If TypeScript detected: add `typescript-lsp@claude-plugins-official`
  - If frontend framework detected: add `frontend-design@claude-plugins-official`, `ui-ux-pro-max@ui-ux-pro-max-skill`
- Hooks (always include session-start and pre-commit-check)
Write the file to `.claude/settings.json`.

## Step 6: Copy Relevant Commands

The following commands are always included (they should already exist in `.claude/commands/`):
- `plan.md`, `fix-build.md`, `doc.md`, `review.md`, `onboarding.md`, `learn.md`, `security-audit.md`, `commit.md`

**Conditionally copy from `.claude/commands/conditional/`:**
- If React/Vue/Svelte detected → copy `component.md`
- If Next.js/Nuxt detected → copy `api-route.md`
- If Supabase/Prisma detected → copy `migration.md`
- If WordPress detected → copy `wp-block.md`
- If Firebase/Vercel/Netlify detected → copy `deploy-check.md`

List what was copied.

## Step 7: Report

Show a summary of everything that was generated:

> "Project setup complete! Here's what I configured:
>
> **CLAUDE.md** — Project context with [stack], [conventions], [workflow]
> **settings.json** — [permission level] permissions, [N] plugins enabled
> **Commands:** [list of active commands]
> **Hooks:** session-start (context loading), pre-commit (standards check)
>
> **Next: Running `/onboarding` to walk you through the project...**"

**After showing the report, read and execute the `/onboarding` command** (`.claude/commands/onboarding.md`). This handles the project walkthrough. Do not ask the user to run it manually — invoke it directly as the next step in this flow.

## Step 8: Update Mode

When CLAUDE.md already has real content:

1. Read and parse the current CLAUDE.md
2. Show a summary:
> "Current setup:
> - Stack: [framework] + [database] + [styling]
> - Language: [language]
> - Testing: [framework] — [coverage level]
> - Git: [branch pattern], [commit format]
> - Task Tracking: [system]
> - Autonomy: [level]
>
> What would you like to change? You can:
> (a) Update a specific section — tell me which
> (b) Re-run the full setup from scratch
> (c) Just update detected stack info (re-scan files)"

3. Based on the answer, re-ask only the relevant questions
4. Regenerate only the affected files/sections
5. Show a diff of what changed
