import Database from "better-sqlite3";
import path from "path";
import { runMigrations } from "./migrate";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "kanban.db");

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    // Schema is owned by the versioned migration runner (migrations/*.sql).
    // It runs before seeding so the agents table is guaranteed to exist.
    runMigrations(db);
    seedDefaultAgents(db);
  }
  return db;
}

// Default agents are DATA, not schema, so they live here (run after migrations)
// rather than inside a migration file. Only seeds when the table is empty, so
// existing live databases are left untouched.
function seedDefaultAgents(db: Database.Database) {
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
