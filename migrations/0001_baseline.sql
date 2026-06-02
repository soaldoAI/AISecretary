-- 0001_baseline.sql
-- Baseline schema for Launchdesk.
--
-- Reproduces the schema that previously lived inline in src/lib/db.ts
-- (initSchema). Every statement uses IF NOT EXISTS so that this file is:
--   * a full bootstrap on a fresh database, and
--   * a safe no-op on the founder's existing live kanban.db
-- while still being recorded in schema_version as "applied".
--
-- Data seeding (default agents) is intentionally NOT in this file. Seeding is
-- data, not schema, and stays in src/lib/db.ts so it runs after migrations.

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  avatar TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'backlog',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to INTEGER REFERENCES agents(id),
  due_date TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
