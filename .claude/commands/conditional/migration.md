---
description: Create a database migration file. Supports Supabase, Prisma, and raw SQL migrations.
---

# Database Migration Generator

Create a new database migration following your project's migration patterns.

## Usage
- `/migration <description>` — create a migration (e.g., `/migration add user roles table`)
- `/migration <description> --sql` — generate raw SQL migration

## Behavior

### Step 1: Detect Migration System

1. Read CLAUDE.md for database info
2. Detect the migration tool:
   - `supabase/migrations/` → Supabase CLI migrations
   - `prisma/` → Prisma Migrate
   - `migrations/` with numbered SQL files → Raw SQL migrations
   - `wp-content/` → WordPress dbDelta pattern

### Step 2: Understand the Schema

1. Read existing migration files to understand current schema
2. If Prisma: read `prisma/schema.prisma` for the current model definitions
3. If Supabase: read recent migrations for table structure
4. Identify naming conventions (snake_case? plurals? prefixes?)

### Step 3: Generate Migration

**Supabase (`supabase/migrations/YYYYMMDDHHMMSS_<description>.sql`):**
```sql
-- Up migration
CREATE TABLE IF NOT EXISTS ...;

-- Add RLS policies
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...;
```

**Prisma (`prisma/migrations/YYYYMMDDHHMMSS_<description>/migration.sql`):**
- Also update `prisma/schema.prisma` with the new model
- Generate the SQL migration via `npx prisma migrate dev --name <description>`

**Raw SQL:**
```sql
-- Up
CREATE TABLE ...;

-- Down
DROP TABLE IF EXISTS ...;
```

### Step 4: Security Considerations

For every migration, check:
- **RLS policies** (Supabase): Always add appropriate Row Level Security
- **Indexes:** Add indexes on foreign keys and frequently queried columns
- **Constraints:** NOT NULL, UNIQUE, CHECK constraints where appropriate
- **Down migration:** Always include a way to reverse the migration

### Step 5: Present & Confirm

Show the migration and ask:
> "Here's the migration. Review the SQL carefully before applying.
> Want me to write this file? (yes/modify/cancel)"

**After writing, remind:**
> "Run `npx supabase db push` (or your migration command) to apply."

Only write after confirmation.
