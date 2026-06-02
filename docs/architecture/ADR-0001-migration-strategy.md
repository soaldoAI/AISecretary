# ADR-0001: Database Migration Strategy

## Status

Accepted

## Context

Launchdesk's schema was, until now, created by inline `CREATE TABLE IF NOT EXISTS`
statements in `src/lib/db.ts` (`initSchema`). That was fine for the first two
tables (`agents`, `tasks`), but it breaks down as soon as the schema needs to
*change* rather than just *exist*:

- `CREATE TABLE IF NOT EXISTS` can create a missing table, but it can never
  **alter** an existing one. Adding a column, changing a default, backfilling
  data, or renaming something is impossible through that mechanism.
- There is **no ordering** and **no record** of what has been applied. You
  cannot tell, from the database, which schema changes a given `kanban.db` has
  seen.
- The roadmap adds real schema churn: the **Co-Pilot** feature, **Telegram
  intake**, **business memory**, and an **audit trail** all introduce new
  tables and columns. Each of those is a schema change that must be applied, in
  order, to a database that already holds the founder's live data.
- The founder already runs a live `kanban.db` on the NUC. Hand-editing a live
  SQLite database with ad-hoc SQL is error-prone and unrepeatable — there is no
  way to know whether a given change was applied, applied twice, or skipped.

We need a way to evolve the schema over time, in order, with a durable record
of what has been applied — without violating Launchdesk's core constraints
(SQLite only, keep it simple, one user, no heavy dependencies).

## Decision

Adopt a **minimal, forward-only, versioned SQL migration system** built on the
tools already in the project (`better-sqlite3` + the filesystem). No ORM, no
Knex, no Prisma, no Drizzle, no external migration library.

### Components

1. **`migrations/` folder at the repo root** containing numbered raw SQL files:

   ```
   migrations/
     0001_baseline.sql
     0002_....sql
     0003_....sql
   ```

   Naming convention: **`NNNN_short_description.sql`**, where `NNNN` is a
   zero-padded sequence number. Files are applied in **lexical order**, which
   for zero-padded numbers is also numeric order. The version key recorded for
   a file is its leading number (`0001`), so a file can be renamed/clarified
   without re-applying as long as its number is stable.

2. **`schema_version` table** in the database, created by the runner if absent:

   ```sql
   CREATE TABLE IF NOT EXISTS schema_version (
     version    TEXT PRIMARY KEY,   -- e.g. "0001"
     name       TEXT NOT NULL,      -- e.g. "0001_baseline.sql"
     applied_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   ```

   One row per applied migration. This is the durable record of what the
   database has seen.

3. **The runner** (`src/lib/migrate.ts`, plain TypeScript, raw SQL via
   `better-sqlite3`). On the first connection it:
   - ensures the `schema_version` table exists;
   - reads every `*.sql` file in `migrations/`, sorted;
   - loads the set of already-applied version keys from `schema_version`;
   - for each file **not** yet applied, runs the file's SQL **and** records the
     row in `schema_version` **inside a single transaction** (so a migration
     either fully applies and is recorded, or neither happens);
   - is fully **synchronous** (better-sqlite3 is synchronous) and runs during
     `getDb()` initialization, **before** agent seeding.

### Baseline (`0001_baseline.sql`)

The baseline reproduces the *current* schema exactly: the `agents` and `tasks`
tables and the two indexes (`idx_tasks_status`, `idx_tasks_assigned`). Every
statement uses `IF NOT EXISTS`. This makes the baseline behave correctly in both
worlds:

- **Fresh database:** the baseline creates all tables and indexes.
- **Existing live `kanban.db`:** the tables already exist, so each statement is
  a no-op — but the runner still records `0001` in `schema_version`, reconciling
  the pre-existing database into the new system without any data loss.

### Seeding

Seeding the 10 default agents is **data, not schema**, so it stays in
`src/lib/db.ts` and runs **after** migrations, guarded by an "only if the
`agents` table is empty" check. It is deliberately *not* a migration file.

### Migrations folder path resolution

The runner resolves the folder as `process.cwd()/migrations`, with a
`MIGRATIONS_DIR` environment override. This mirrors how `src/lib/db.ts` already
resolves the SQLite file (`process.cwd()/kanban.db` with a `DB_PATH` override),
so the database and its migrations are always located consistently.

This is sound for Launchdesk because it is a self-hosted, long-running
`next start` process whose working directory is the project root in both `next
dev` and `next start`. The SQL files are read from disk **at runtime** via `fs`
(they are not imported/bundled), so they only need to physically exist relative
to the working directory — which they do. We explicitly chose runtime `fs`
reads of raw `.sql` files (over, say, inlining SQL as bundled string modules)
to keep migrations as plain, reviewable SQL. The `MIGRATIONS_DIR` override is
the escape hatch if Launchdesk is ever launched from a non-root cwd.

### Adding a migration going forward

1. Create the next numbered file, e.g. `migrations/0002_add_copilot_tables.sql`.
2. Write plain SQL (forward changes only — `CREATE TABLE`, `ALTER TABLE`,
   `CREATE INDEX`, data backfills, etc.).
3. That's it. On the next startup (`getDb()`), the runner detects the new file,
   applies it in a transaction, and records it in `schema_version`.

## Alternatives considered

- **(a) Keep inline `CREATE TABLE IF NOT EXISTS` in `db.ts`.**
  *Rejected.* Cannot alter existing columns or migrate data, has no ordering,
  and keeps no record of what has been applied. It only ever solves "make sure
  the table exists," which is not enough for the roadmap.

- **(b) An ORM / Knex / Prisma migrations.**
  *Rejected.* Far too heavy for a single-user app. Adds large dependencies, a
  query layer, codegen, and/or a migration CLI, directly violating the project's
  "keep it simple, no ORMs, no Knex" constraint. We want raw SQL on
  `better-sqlite3`, not an abstraction over it.

- **(c) Drizzle Kit or a similar schema-diffing toolkit.**
  *Rejected.* Over-engineered for one user on one NUC. Schema diffing, generated
  migrations, and a separate toolchain add complexity and dependencies with no
  payoff at this scale.

The chosen approach adds **zero new dependencies** — it is ~80 lines of
TypeScript over the `better-sqlite3` connection we already have.

## Consequences

- **Forward-only (no down migrations in the MVP).** We deliberately do not
  implement rollbacks. For a single-user, self-hosted app, the recovery story is
  simpler and safer as a **file backup of `kanban.db`** before a risky change
  than as hand-written, rarely-tested down-migrations. Down migrations are a
  recurring source of bugs and add complexity we do not need for one user. If a
  migration is wrong, the fix is a new forward migration (or restore from
  backup).
- **SQL must be hand-written.** There is no schema generation. This is a
  feature, not a bug, for this project — migrations stay transparent and
  reviewable — but it does mean the author is responsible for correct SQL.
- **The numbering convention must be followed.** Files must be numbered and
  unique; lexical order is the apply order. Two people creating `0002_*` at once
  would collide — manageable for a solo founder, but worth noting now that more
  than one agent contributes migrations (e.g. the Co-Pilot work authors a new
  numbered file).
- **Baseline reconciliation for the existing database.** The founder's live
  `kanban.db` is brought into the system by `0001_baseline.sql` being recorded
  as applied on first run, with no data loss because every baseline statement is
  `IF NOT EXISTS`. After that first run, the database is fully managed by the
  migration system.
- **Migrations run on the request path.** They execute during the first
  `getDb()` of the process. Migrations should stay fast; long-running data
  backfills should be considered carefully (they would delay the first request
  after a deploy). At Launchdesk's scale this is a non-issue.
