import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

declare global {
  var sqliteDb: Database.Database | undefined;
}

function getDb(): Database.Database {
  const sqlitePath = process.env.SQLITE_PATH
    ? path.resolve(process.env.SQLITE_PATH)
    : path.join(process.cwd(), "data", "aipico.sqlite");

  const sqliteDirectory = path.dirname(sqlitePath);

  if (!existsSync(sqliteDirectory)) {
    mkdirSync(sqliteDirectory, { recursive: true });
  }

  if (!global.sqliteDb) {
    global.sqliteDb = new Database(sqlitePath);
    global.sqliteDb.pragma("journal_mode = WAL");
  }

  return global.sqliteDb;
}

let schemaInitPromise: Promise<void> | null = null;

export async function ensurePredictionsTable(): Promise<void> {
  if (!schemaInitPromise) {
    schemaInitPromise = Promise.resolve().then(() => {
      getDb().exec(`
        CREATE TABLE IF NOT EXISTS predictions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          season TEXT NOT NULL,
          matchday INTEGER NOT NULL CHECK (matchday BETWEEN 1 AND 34),
          home_team TEXT NOT NULL,
          away_team TEXT NOT NULL,
          predicted_outcome TEXT NOT NULL CHECK (predicted_outcome IN ('HOME_WIN', 'DRAW', 'AWAY_WIN')),
          predicted_home_goals INTEGER,
          predicted_away_goals INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)
    });
  }

  await schemaInitPromise;
}

export { getDb };
