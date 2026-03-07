import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

type TableColumnInfo = {
  name: string;
};

export type PredictionRecord = {
  id: number;
  season: string;
  matchday: number;
  agent_name: string;
  home_team: string;
  away_team: string;
  predicted_outcome: "HOME_WIN" | "DRAW" | "AWAY_WIN";
  predicted_home_goals: number | null;
  predicted_away_goals: number | null;
  reason: string;
  created_at: string;
};

export type CurrentMatchdayPredictions = {
  season: string;
  matchday: number;
  predictions: PredictionRecord[];
};

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
      const db = getDb();

      db.exec(`
        CREATE TABLE IF NOT EXISTS predictions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          season TEXT NOT NULL,
          matchday INTEGER NOT NULL CHECK (matchday BETWEEN 1 AND 34),
          agent_name TEXT NOT NULL,
          home_team TEXT NOT NULL,
          away_team TEXT NOT NULL,
          predicted_outcome TEXT NOT NULL CHECK (predicted_outcome IN ('HOME_WIN', 'DRAW', 'AWAY_WIN')),
          predicted_home_goals INTEGER,
          predicted_away_goals INTEGER,
          reason TEXT NOT NULL DEFAULT 'No reason provided',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const columns = db
        .prepare("PRAGMA table_info(predictions);")
        .all() as TableColumnInfo[];
      const hasAgentNameColumn = columns.some(
        (column) => column.name === "agent_name",
      );

      if (!hasAgentNameColumn) {
        db.exec(`
          ALTER TABLE predictions
          ADD COLUMN agent_name TEXT NOT NULL DEFAULT 'Unknown Agent';
        `);
      }

      const hasReasonColumn = columns.some((column) => column.name === "reason");

      if (!hasReasonColumn) {
        db.exec(`
          ALTER TABLE predictions
          ADD COLUMN reason TEXT NOT NULL DEFAULT 'No reason provided';
        `);
      }

      db.exec(`
        DELETE FROM predictions
        WHERE id NOT IN (
          SELECT latest_id
          FROM (
            SELECT MAX(id) AS latest_id
            FROM predictions
            GROUP BY season, matchday, home_team, away_team, agent_name
          )
        );

        CREATE UNIQUE INDEX IF NOT EXISTS predictions_unique_agent_fixture
        ON predictions (season, matchday, home_team, away_team, agent_name);

        CREATE INDEX IF NOT EXISTS predictions_latest_lookup
        ON predictions (season, matchday, created_at DESC, id DESC);
      `);
    });
  }

  await schemaInitPromise;
}

export async function getCurrentMatchdayPredictions(): Promise<CurrentMatchdayPredictions | null> {
  await ensurePredictionsTable();

  const db = getDb();

  const latestSeason = db
    .prepare(
      `
      SELECT season
      FROM predictions
      ORDER BY created_at DESC, id DESC
      LIMIT 1;
    `,
    )
    .get() as { season: string } | undefined;

  if (!latestSeason) {
    return null;
  }

  const latestMatchday = db
    .prepare(
      `
      SELECT matchday
      FROM predictions
      WHERE season = ?
      ORDER BY matchday DESC
      LIMIT 1;
    `,
    )
    .get(latestSeason.season) as { matchday: number } | undefined;

  if (!latestMatchday) {
    return null;
  }

  const predictions = db
    .prepare(
      `
      SELECT
        id,
        season,
        matchday,
        agent_name,
        home_team,
        away_team,
        predicted_outcome,
        predicted_home_goals,
        predicted_away_goals,
        reason,
        created_at
      FROM predictions
      WHERE season = ? AND matchday = ?
      ORDER BY home_team ASC, away_team ASC, agent_name ASC;
    `,
    )
    .all(latestSeason.season, latestMatchday.matchday) as PredictionRecord[];

  return {
    season: latestSeason.season,
    matchday: latestMatchday.matchday,
    predictions,
  };
}

export { getDb };
