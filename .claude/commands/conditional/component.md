---
description: Scaffold a new component following project patterns. Detects React/Vue/Svelte and adapts accordingly.
---

# Component Scaffold

Create a new component that follows your project's existing patterns.

## Usage
- `/component <name>` — create a component with the given name
- `/component <name> in <path>` — create in a specific directory

## Behavior

### Step 1: Detect Framework & Patterns

1. Read CLAUDE.md for the project's framework and coding standards
2. Scan existing components to learn the project's patterns:
   - **File structure:** Single file? Directory with index? Co-located styles/tests?
   - **Naming:** PascalCase? kebab-case? How are files named?
   - **Exports:** Named or default exports?
   - **Styling:** Tailwind classes? CSS modules? Styled components? SCSS?
   - **Types:** TypeScript interfaces? Props type? Separate types file?
   - **Testing:** Co-located test file? Separate test directory?

### Step 2: Detect Component Library

Check for component libraries in dependencies:
- `@radix-ui/*` → Radix primitives
- `shadcn` or `@/components/ui` → shadcn/ui
- `@headlessui/*` → Headless UI
- `vuetify` → Vuetify
- `@mantine/*` → Mantine

If found, follow that library's patterns for composition.

### Step 3: Generate Files

Based on detected patterns, create:

**React (TSX):**
```
ComponentName/
├── ComponentName.tsx        # Component implementation
├── ComponentName.test.tsx   # Tests (if project has co-located tests)
└── index.ts                 # Re-export (if project uses barrel exports)
```

**Vue (SFC):**
```
ComponentName/
├── ComponentName.vue        # Single File Component
└── ComponentName.test.ts    # Tests (if project has co-located tests)
```

**Svelte:**
```
ComponentName/
├── ComponentName.svelte     # Component
└── ComponentName.test.ts    # Tests (if project has co-located tests)
```

### Step 4: Component Template

Generate the component with:
- Props interface/type (TypeScript) or props definition (Vue/Svelte)
- Basic structure matching existing components
- Placeholder content with the component name
- JSDoc/comment describing the component's purpose

**Do NOT include:**
- Complex logic — keep it minimal, the developer will add that
- Unnecessary imports
- Features not seen in existing components

### Step 5: Present & Confirm

Show the generated files and ask:
> "Here's the scaffolded component. Want me to write these files? (yes/modify/cancel)"

Only write after confirmation.
