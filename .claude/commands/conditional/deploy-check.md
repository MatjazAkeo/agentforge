---
description: Pre-deployment validation. Runs build, checks env vars, validates config, runs tests, and reports readiness.
---

# Deploy Check

Validate that the project is ready to deploy.

## Usage
- `/deploy-check` — run all checks
- `/deploy-check quick` — skip tests, just check build and config

## Behavior

### Step 1: Detect Deploy Target

1. Read CLAUDE.md for CI/CD and hosting info
2. Detect the deployment platform:
   - `vercel.json` or `.vercel/` → Vercel
   - `netlify.toml` or `_redirects` → Netlify
   - `firebase.json` → Firebase Hosting / Cloud Functions
   - `fly.toml` → Fly.io
   - `Dockerfile` → Docker-based deployment
   - `.github/workflows/` with deploy steps → GitHub Actions
   - `wp-content/` → WordPress (FTP/SSH/Git deploy)

### Step 2: Run Checks

Execute these checks in order, reporting results as a checklist:

**Build Check:**
- [ ] Run the project's build command (`npm run build`, `pnpm build`, etc.)
- [ ] Verify build completes without errors
- [ ] Check build output exists and is non-empty

**TypeScript Check** (if applicable):
- [ ] Run `npx tsc --noEmit`
- [ ] Verify no type errors

**Lint Check** (if applicable):
- [ ] Run the project's lint command
- [ ] Report any errors (warnings are OK)

**Test Check** (unless `quick` mode):
- [ ] Run the project's test command
- [ ] Report pass/fail counts

**Environment Variables:**
- [ ] Read `.env.example` or `.env.local.example` for required variables
- [ ] Check that all required vars are set in `.env` or `.env.local`
- [ ] Flag any vars that look like placeholders (YOUR_KEY_HERE, xxx, etc.)
- [ ] Verify no secrets in `NEXT_PUBLIC_*` or client-side env vars

**Config Validation:**
- [ ] Vercel: validate `vercel.json` structure
- [ ] Netlify: validate `netlify.toml` structure
- [ ] Firebase: validate `firebase.json` and check rules files exist
- [ ] Docker: verify `Dockerfile` builds (or just check syntax)

**Security Quick Check:**
- [ ] No `.env` files in git (`git ls-files '*.env*'`)
- [ ] No hardcoded secrets in build output
- [ ] Security headers configured (if platform supports it)

**Dependency Check:**
- [ ] Run `npm audit` — report HIGH/CRITICAL only
- [ ] Check for outdated major versions of core dependencies

### Step 3: Report

Present results as a deployment readiness report:

```
## Deploy Readiness Report

### Status: READY / NOT READY / WARNINGS

| Check | Status | Notes |
|-------|--------|-------|
| Build | PASS | Built in 12s |
| TypeScript | PASS | No errors |
| Lint | PASS | 2 warnings (non-blocking) |
| Tests | PASS | 47/47 tests passed |
| Env vars | WARN | ANALYTICS_KEY looks like a placeholder |
| Config | PASS | vercel.json valid |
| Security | PASS | No secrets exposed |
| Dependencies | WARN | 1 high severity npm audit finding |

### Blockers (must fix before deploy)
- [list any FAIL items]

### Warnings (review before deploy)
- [list any WARN items]

### Ready to deploy!
```

If any check FAILs, status is NOT READY and blockers are listed.
If only warnings, status is WARNINGS with the advisory list.
If all pass, status is READY.
