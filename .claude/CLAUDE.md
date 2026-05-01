# Project: {project_name}

{project_description}

## Tech Stack
- **Framework:** {framework}
- **Language:** {language}
- **Styling:** {styling}
- **Database:** {database}
- **Package Manager:** npm
- **Testing:** {testing_framework}
- **CI/CD:** {cicd}

## Project Structure
{project_structure}

## Coding Standards

### General
- Follow existing patterns in the codebase before introducing new ones
- Use the project's linter config — do not override or disable rules
{additional_coding_rules}

### Language-Specific
{language_specific_rules}

### Testing
{testing_rules}

## Security
- **Auth Provider:** {auth_provider}
- **Secrets Management:** Environment variables via `.env.local` (never commit secrets)
- **Security Headers:** {where_headers_are_configured}
- **Known Exceptions:** {any_intentional_security_trade_offs}

## Git Workflow
- **Branches:** `feat/description` (short prefix style)
- **Commits:** Conventional commits — `type(scope): description`
- **PRs:** {pr_process}
- Do not auto-commit. Always ask before committing.
- Do not push unless explicitly asked.
- Do NOT add Co-Authored-By trailers to commit messages.
- Use `/commit` instead of raw `git commit` for the full review+learn workflow.

## Task Tracking
- **System:** Internal (`docs/progress/`)
- See `docs/progress/current.md` for active tasks
- Update progress when starting or completing tasks.

## Documentation
- Project docs live in `docs/documentation/`
- Use separate markdown files per topic
- Update relevant docs when changing public APIs or architecture

## Environment Variables
- Required: {env_vars}
- See `.env.example` for all required values
- Claude should warn when env vars appear to be missing from `.env` or `.env.local`

## Workflow

### Starting a new feature
1. Run `/brainstorming <idea>` (from superpowers plugin) — dialogue to refine the idea and approve a design
2. Run `/plan <description>` — creates branch, adds to progress, scaffolds docs, creates implementation plan
3. Implementation plan saved to `docs/plans/<feature-name>-plan.md`
4. `/plan` offers execution options: subagent-driven (recommended), inline, or manual
5. Run `/commit` after each logical chunk — reviews, learns, updates progress + docs + plan checkboxes, commits

### Useful commands during development
- `/review` — review changes against team standards
- `/doc` — generate or update documentation in `docs/documentation/`
- `/learn` — capture decisions, gotchas, patterns
- `/security-audit` — run security checks
- `/fix-build` — fix build/type errors

## Claude Behavior
{autonomy_rules}
- Read recent git log at session start for context
- Check `docs/decisions/` for past architectural decisions before proposing alternatives
- Check `docs/plans/` for active implementation plans
- When unsure about a convention, check existing code before asking
