---
description: Generate or update documentation for a file, module, or API endpoint.
---

# Documentation Generator

## Usage
- `/doc` — auto-detect what needs documenting based on recent changes
- `/doc <path>` — document a specific file or directory
- `/doc api` — document all API routes
- `/doc update` — update existing docs to match current code

## Behavior

1. **Read CLAUDE.md** for the project's documentation conventions (location, format, style)

2. **Determine scope:**
   - If a specific path is given, document that file/directory
   - If `api` is given, find all API route files and document them
   - If `update` is given, find docs that are stale compared to their source code
   - If no argument, check `git diff HEAD~5` for recently changed files that lack documentation

3. **Dispatch the `doc-writer` agent** to generate the documentation. Provide it with:
   - The files to document
   - The documentation conventions from CLAUDE.md
   - The target output location: `docs/documentation/`

4. **Present the generated documentation** for review before writing any files

5. **Write the files** only after user approval

## Documentation Types

**API docs** (for route files):
- Endpoint URL, method
- Request parameters and body shape
- Response shape with example
- Error codes and their meaning
- Authentication requirements

**Module docs** (for lib/utility files):
- Purpose and responsibility
- Exported functions/classes with signatures
- Usage examples
- Dependencies

**Component docs** (for UI components):
- Props interface with types and descriptions
- Usage example
- Visual states (loading, error, empty)

**Client-facing docs** (for help/guides):
- Plain language, no jargon
- Step-by-step instructions
- Screenshot placeholders where relevant
