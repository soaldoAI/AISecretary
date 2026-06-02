import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";

/**
 * Minimal forward-only migration runner for Launchdesk.
 *
 * See docs/architecture/ADR-0001-migration-strategy.md for the full rationale.
 *
 * Convention: migrations live in the `migrations/` folder at the repo root as
 * numbered raw SQL files named `NNNN_description.sql` (e.g. `0001_baseline.sql`).
 * They are applied in lexical order. Each applied file is recorded in the
 * `schema_version` table, so subsequent startups skip it.
 *
 * To add a migration: drop the next numbered file into `migrations/`. It is
 * applied automatically on the next `getDb()` call. No down migrations.
 */

const MIGRATIONS_DIRNAME = "migrations";

/**
 * Resolve the migrations directory.
 *
 * We rely on `process.cwd()` (with a `MIGRATIONS_DIR` env override). This mirrors
 * how src/lib/db.ts already resolves the SQLite file (`process.cwd()/kanban.db`),
 * so the two are always consistent. Launchdesk is a self-hosted, long-running
 * `next start` process on a single NUC, so cwd is the project root in both dev
 * and production. The SQL files are read from disk at runtime (not bundled), so
 * they only need to physically exist relative to cwd, which they do.
 */
function resolveMigrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) {
    return path.resolve(process.env.MIGRATIONS_DIR);
  }
  return path.join(process.cwd(), MIGRATIONS_DIRNAME);
}

function ensureSchemaVersionTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function getAppliedVersions(db: Database.Database): Set<string> {
  const rows = db.prepare("SELECT version FROM schema_version").all() as {
    version: string;
  }[];
  return new Set(rows.map((r) => r.version));
}

/** Extract the numeric/lexical version key from a filename: `0001_baseline.sql` -> `0001`. */
function versionFromFilename(file: string): string {
  const match = /^(\d+)/.exec(file);
  return match ? match[1] : file;
}

/**
 * Run all pending migrations in order. Idempotent and synchronous.
 *
 * Each pending file is applied inside its own transaction together with the
 * `schema_version` insert, so a file either fully applies and is recorded, or
 * neither happens.
 */
export function runMigrations(db: Database.Database): void {
  const dir = resolveMigrationsDir();

  ensureSchemaVersionTable(db);

  if (!fs.existsSync(dir)) {
    throw new Error(
      `[migrate] migrations directory not found at "${dir}". ` +
        `Set MIGRATIONS_DIR or run from the project root.`,
    );
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = getAppliedVersions(db);
  const record = db.prepare(
    "INSERT INTO schema_version (version, name) VALUES (?, ?)",
  );

  for (const file of files) {
    const version = versionFromFilename(file);
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(dir, file), "utf8");

    // exec() runs every statement in the file; the transaction wraps both the
    // schema changes and the bookkeeping insert. SQL files must NOT contain
    // their own BEGIN/COMMIT (better-sqlite3 manages the transaction here).
    const apply = db.transaction(() => {
      db.exec(sql);
      record.run(version, file);
    });
    apply();
  }
}
