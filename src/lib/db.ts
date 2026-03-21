import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { MAX_MATCHDAY, MIN_MATCHDAY } from "@/lib/constants";

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

export type MatchdayReference = {
  season: string;
  matchday: number;
};

type MatchdayDateRange = {
  matchday: number;
  startDate: string;
  endDate: string;
};

const BUNDESLIGA_2025_26_MATCHDAY_DATES: MatchdayDateRange[] = [
  { matchday: 1, startDate: "2025-08-22", endDate: "2025-08-24" },
  { matchday: 2, startDate: "2025-08-29", endDate: "2025-08-31" },
  { matchday: 3, startDate: "2025-09-12", endDate: "2025-09-14" },
  { matchday: 4, startDate: "2025-09-19", endDate: "2025-09-21" },
  { matchday: 5, startDate: "2025-09-26", endDate: "2025-09-28" },
  { matchday: 6, startDate: "2025-10-03", endDate: "2025-10-05" },
  { matchday: 7, startDate: "2025-10-17", endDate: "2025-10-19" },
  { matchday: 8, startDate: "2025-10-24", endDate: "2025-10-26" },
  { matchday: 9, startDate: "2025-10-31", endDate: "2025-11-02" },
  { matchday: 10, startDate: "2025-11-07", endDate: "2025-11-09" },
  { matchday: 11, startDate: "2025-11-21", endDate: "2025-11-23" },
  { matchday: 12, startDate: "2025-11-28", endDate: "2025-11-30" },
  { matchday: 13, startDate: "2025-12-05", endDate: "2025-12-07" },
  { matchday: 14, startDate: "2025-12-12", endDate: "2025-12-14" },
  { matchday: 15, startDate: "2025-12-19", endDate: "2025-12-21" },
  { matchday: 16, startDate: "2026-01-09", endDate: "2026-01-11" },
  { matchday: 17, startDate: "2026-01-16", endDate: "2026-01-18" },
  { matchday: 18, startDate: "2026-01-23", endDate: "2026-01-25" },
  { matchday: 19, startDate: "2026-01-30", endDate: "2026-02-01" },
  { matchday: 20, startDate: "2026-02-06", endDate: "2026-02-08" },
  { matchday: 21, startDate: "2026-02-13", endDate: "2026-02-15" },
  { matchday: 22, startDate: "2026-02-20", endDate: "2026-02-22" },
  { matchday: 23, startDate: "2026-02-20", endDate: "2026-02-22" },
  { matchday: 24, startDate: "2026-02-27", endDate: "2026-03-01" },
  { matchday: 25, startDate: "2026-03-06", endDate: "2026-03-08" },
  { matchday: 26, startDate: "2026-03-13", endDate: "2026-03-15" },
  { matchday: 27, startDate: "2026-03-20", endDate: "2026-03-22" },
  { matchday: 28, startDate: "2026-04-03", endDate: "2026-04-05" },
  { matchday: 29, startDate: "2026-04-10", endDate: "2026-04-12" },
  { matchday: 30, startDate: "2026-04-17", endDate: "2026-04-19" },
  { matchday: 31, startDate: "2026-04-24", endDate: "2026-04-26" },
  { matchday: 32, startDate: "2026-05-01", endDate: "2026-05-03" },
  { matchday: 33, startDate: "2026-05-08", endDate: "2026-05-10" },
  { matchday: 34, startDate: "2026-05-15", endDate: "2026-05-17" },
];

function getBerlinDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getHardcodedCurrentMatchdayReference(date: Date): MatchdayReference | null {
  const berlinDate = getBerlinDateString(date);
  const current = BUNDESLIGA_2025_26_MATCHDAY_DATES.find(
    (entry) => berlinDate >= entry.startDate && berlinDate <= entry.endDate,
  );

  if (!current) {
    return null;
  }

  return {
    season: "2025-26",
    matchday: current.matchday,
  };
}

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
          matchday INTEGER NOT NULL CHECK (matchday BETWEEN ${MIN_MATCHDAY} AND ${MAX_MATCHDAY}),
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

  const hardcodedCurrent = getHardcodedCurrentMatchdayReference(new Date());

  if (hardcodedCurrent) {
    const hardcodedPredictions = await getMatchdayPredictions(
      hardcodedCurrent.season,
      hardcodedCurrent.matchday,
    );

    if (hardcodedPredictions) {
      return hardcodedPredictions;
    }

    return {
      season: hardcodedCurrent.season,
      matchday: hardcodedCurrent.matchday,
      predictions: [],
    };
  }

  const db = getDb();

  const latestMatchdayRef = db
    .prepare(
      `
      SELECT season, matchday
      FROM predictions
      ORDER BY created_at DESC, id DESC
      LIMIT 1;
    `,
    )
    .get() as MatchdayReference | undefined;

  if (!latestMatchdayRef) {
    return null;
  }

  return getMatchdayPredictions(latestMatchdayRef.season, latestMatchdayRef.matchday);
}

export async function getMatchdayPredictions(
  season: string,
  matchday: number,
): Promise<CurrentMatchdayPredictions | null> {
  await ensurePredictionsTable();

  const db = getDb();

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
    .all(season, matchday) as PredictionRecord[];

  if (predictions.length === 0) {
    return null;
  }

  return {
    season,
    matchday,
    predictions,
  };
}

export async function listAvailableMatchdays(): Promise<MatchdayReference[]> {
  await ensurePredictionsTable();

  const db = getDb();

  return db
    .prepare(
      `
      SELECT season, matchday
      FROM predictions
      GROUP BY season, matchday
      ORDER BY season DESC, matchday DESC;
    `,
    )
    .all() as MatchdayReference[];
}

export { getDb };
