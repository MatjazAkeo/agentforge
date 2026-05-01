---
description: Scaffold a WordPress Gutenberg block with block.json, edit component, save component, and styles.
---

# WordPress Block Scaffold

Create a new Gutenberg block following WordPress block API patterns.

## Usage
- `/wp-block <name>` — create a block (e.g., `/wp-block testimonial-carousel`)
- `/wp-block <name> dynamic` — create a dynamic (server-rendered) block

## Behavior

### Step 1: Detect Block Patterns

1. Read CLAUDE.md for WordPress conventions
2. Scan existing blocks in the project to learn patterns:
   - **Location:** `src/blocks/`? `blocks/`? Plugin-specific path?
   - **Build tool:** `@wordpress/scripts`? Custom webpack? Vite?
   - **JS framework:** Plain JS? React JSX? TypeScript?
   - **Styles:** SCSS? CSS? Tailwind?
3. Check if `@wordpress/scripts` is in devDependencies

### Step 2: Generate Block Files

**Standard block structure:**
```
blocks/<block-name>/
├── block.json          # Block metadata (name, title, category, attributes)
├── edit.js             # Editor component (what appears in Gutenberg editor)
├── save.js             # Frontend output (what gets saved to post content)
├── index.js            # Block registration
├── editor.scss         # Editor-only styles
└── style.scss          # Frontend + editor styles
```

**For dynamic blocks** (server-rendered):
```
blocks/<block-name>/
├── block.json          # With "render": "file:./render.php"
├── edit.js             # Editor component
├── index.js            # Block registration (no save — returns null)
├── render.php          # Server-side render template
├── editor.scss         # Editor-only styles
└── style.scss          # Frontend + editor styles
```

### Step 3: block.json

Generate following WordPress block API v3:
```json
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "namespace/block-name",
  "version": "1.0.0",
  "title": "Block Title",
  "category": "widgets",
  "icon": "smiley",
  "description": "Block description",
  "supports": {
    "html": false,
    "align": true,
    "color": { "background": true, "text": true }
  },
  "attributes": {},
  "textdomain": "theme-or-plugin-textdomain",
  "editorScript": "file:./index.js",
  "editorStyle": "file:./editor.css",
  "style": "file:./style.css"
}
```

Use the project's namespace (from existing blocks or plugin slug).

### Step 4: Security Considerations

- Escape all output in save.js and render.php (`esc_html`, `esc_attr`, `wp_kses`)
- Sanitize all attributes in PHP render
- Use `useBlockProps` for proper block wrapper

### Step 5: Present & Confirm

Show all generated files and ask:
> "Here's the scaffolded block. Want me to write these files? (yes/modify/cancel)"

Only write after confirmation.
