---
description: Generate an API route with proper typing, error handling, and validation. For Next.js and Nuxt projects.
---

# API Route Generator

Scaffold a new API route following your project's existing patterns.

## Usage
- `/api-route <path>` — create a route at the given path (e.g., `/api-route users/[id]`)
- `/api-route <path> <methods>` — specify HTTP methods (e.g., `/api-route users GET,POST`)

## Behavior

### Step 1: Detect Framework & Patterns

1. Read CLAUDE.md for the project's framework and conventions
2. Detect the routing system:
   - `app/api/` → Next.js App Router (route.ts)
   - `pages/api/` → Next.js Pages Router (handler function)
   - `server/api/` → Nuxt (defineEventHandler)
3. Scan existing API routes to learn patterns:
   - **Error handling:** Try/catch? Error middleware? Shared error handler?
   - **Validation:** Zod? Yup? Manual? None?
   - **Auth:** Middleware? Inline check? Session?
   - **Response format:** Consistent shape? Status codes?
   - **Types:** Request/response types? Shared types file?

### Step 2: Detect Validation & Auth

Check dependencies and existing routes for:
- `zod` → Generate Zod schemas for request validation
- `next-auth` / `@auth/core` → Include auth check
- `@supabase/ssr` → Include Supabase client creation
- Custom auth middleware → Reuse it

### Step 3: Generate Route File

**Next.js App Router (`app/api/[path]/route.ts`):**
```typescript
// Includes:
// - Type-safe request/response
// - Validation with Zod (if detected)
// - Auth check (if project uses auth)
// - Error handling matching existing patterns
// - HTTP method handlers (GET, POST, PUT, DELETE as requested)
```

**Next.js Pages Router (`pages/api/[path].ts`):**
```typescript
// Includes:
// - NextApiRequest/NextApiResponse types
// - Method routing switch
// - Validation and auth as above
```

**Nuxt (`server/api/[path].ts`):**
```typescript
// Includes:
// - defineEventHandler
// - readBody for POST/PUT
// - Validation and auth as above
```

### Step 4: Generate Test File

If the project has API route tests, also generate a test file following the existing test patterns.

### Step 5: Present & Confirm

Show the generated files and ask:
> "Here's the scaffolded API route. Want me to write these files? (yes/modify/cancel)"

Only write after confirmation.
