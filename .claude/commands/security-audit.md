---
description: Run a security audit on the project or a specific file/directory. Checks OWASP Top 10, dependencies, secrets, auth patterns, and security headers.
---

# Security Audit

Run a focused security audit against your project or specific files.

## Usage
- `/security-audit` — audit the entire project
- `/security-audit <path>` — audit a specific file or directory
- `/security-audit deps` — audit dependencies only (npm audit / composer audit)
- `/security-audit secrets` — scan for hardcoded secrets and credentials only
- `/security-audit headers` — review security headers and CSP configuration only

## Behavior

1. **Read CLAUDE.md** for the project's tech stack and Security section

2. **Detect the stack** to determine which checks apply:
   - Check for `next.config.*`, `nuxt.config.*`, `svelte.config.*` (JS/TS frontend)
   - Check for `wp-content/`, `composer.json` (WordPress/PHP)
   - Check for `firebase.json`, `@supabase/supabase-js` (BaaS)
   - Check for API route directories, GraphQL schemas

3. **Determine scope:**
   - If no argument: audit the full project (all categories)
   - If path given: audit only that file/directory (skip dependency and header checks)
   - If `deps`/`secrets`/`headers`: run only that category

4. **Dispatch the `security-auditor` agent** with:
   - The detected stack
   - The scope (full project, path, or category)
   - The Security section from CLAUDE.md (if it exists)

5. **Present the report** grouped by severity:
   - **CRITICAL** — Exploitable now. Must fix before deploying.
   - **HIGH** — Serious risk. Fix in this sprint.
   - **MEDIUM** — Should fix. Schedule it.
   - **LOW** — Hardening opportunity. Nice to have.

6. **Offer next steps:**
   - For CRITICAL/HIGH: offer to generate fix patches
   - For dependency issues: show the exact upgrade commands
   - For secrets: offer to help move them to environment variables
