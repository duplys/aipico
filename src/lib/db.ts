import { Pool } from "pg";

declare global {
  var pgPool: Pool | undefined;
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  if (!global.pgPool) {
    global.pgPool = new Pool({ connectionString });
  }

  return global.pgPool;
}

let schemaInitPromise: Promise<void> | null = null;

export async function ensurePredictionsTable(): Promise<void> {
  if (!schemaInitPromise) {
    schemaInitPromise = getPool()
      .query(`
        CREATE TABLE IF NOT EXISTS predictions (
          id BIGSERIAL PRIMARY KEY,
          season VARCHAR(20) NOT NULL,
          matchday SMALLINT NOT NULL CHECK (matchday BETWEEN 1 AND 34),
          home_team VARCHAR(80) NOT NULL,
          away_team VARCHAR(80) NOT NULL,
          predicted_outcome VARCHAR(12) NOT NULL CHECK (predicted_outcome IN ('HOME_WIN', 'DRAW', 'AWAY_WIN')),
          predicted_home_goals SMALLINT,
          predicted_away_goals SMALLINT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)
      .then(() => undefined);
  }

  await schemaInitPromise;
}

export { getPool };
