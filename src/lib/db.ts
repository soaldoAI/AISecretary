import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "kanban.db");

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
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
  `);

  // Seed default agents if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare("INSERT INTO agents (name, role, avatar) VALUES (?, ?, ?)");
    const agents = [
      ["Sohan", "CEO", "👔"],
      ["Atlas", "Sales", "📈"],
      ["Nova", "Marketing", "📣"],
      ["Forge", "Developer", "💻"],
      ["Sentinel", "QA", "🔍"],
      ["Blueprint", "Architect", "🏗️"],
      ["Scout", "Researcher", "🔬"],
      ["Echo", "Research Assistant", "📚"],
      ["Ledger", "Accountant", "📊"],
      ["Shield", "Legal", "⚖️"],
    ];
    const insertMany = db.transaction((items: string[][]) => {
      for (const [name, role, avatar] of items) {
        insert.run(name, role, avatar);
      }
    });
    insertMany(agents);
  }
}

export default getDb;
