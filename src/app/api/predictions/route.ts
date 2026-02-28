import { NextResponse } from "next/server";
import { z } from "zod";

import { ensurePredictionsTable, getDb } from "@/lib/db";

export const runtime = "nodejs";

const createPredictionSchema = z
  .object({
    season: z.string().min(4).max(20),
    matchday: z.number().int().min(1).max(34),
    agentName: z.string().trim().min(1).max(80),
    predictions: z.array(
      z
        .object({
          homeTeam: z.string().trim().min(1).max(80).optional(),
          awayTeam: z.string().trim().min(1).max(80).optional(),
          home: z.string().trim().min(1).max(80).optional(),
          away: z.string().trim().min(1).max(80).optional(),
          predictedOutcome: z.enum(["HOME_WIN", "DRAW", "AWAY_WIN"]),
          predictedHomeGoals: z.number().int().min(0).max(20).optional(),
          predictedAwayGoals: z.number().int().min(0).max(20).optional(),
          reason: z.string().trim().min(1).max(10000),
        })
        .refine((value) => (value.homeTeam ?? value.home) !== undefined, {
          message: "homeTeam is required",
          path: ["homeTeam"],
        })
        .refine((value) => (value.awayTeam ?? value.away) !== undefined, {
          message: "awayTeam is required",
          path: ["awayTeam"],
        })
        .transform((value) => ({
          homeTeam: (value.homeTeam ?? value.home)!,
          awayTeam: (value.awayTeam ?? value.away)!,
          predictedOutcome: value.predictedOutcome,
          predictedHomeGoals: value.predictedHomeGoals,
          predictedAwayGoals: value.predictedAwayGoals,
          reason: value.reason,
        }))
        .refine(
          (value) =>
            (value.predictedHomeGoals === undefined &&
              value.predictedAwayGoals === undefined) ||
            (value.predictedHomeGoals !== undefined &&
              value.predictedAwayGoals !== undefined),
          {
            message:
              "predictedHomeGoals and predictedAwayGoals must either both be set or both be omitted",
            path: ["predictedHomeGoals"],
          },
        ),
    ),
  })
  .refine((value) => value.predictions.length > 0, {
    message: "predictions must contain at least one entry",
    path: ["predictions"],
  });

type PredictionRow = {
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

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createPredictionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  await ensurePredictionsTable();

  const db = getDb();

  const insertPrediction = db.prepare(
    `
      INSERT INTO predictions (
        season,
        matchday,
        agent_name,
        home_team,
        away_team,
        predicted_outcome,
        predicted_home_goals,
        predicted_away_goals,
        reason
      )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (season, matchday, home_team, away_team, agent_name)
      DO UPDATE SET
        predicted_outcome = excluded.predicted_outcome,
        predicted_home_goals = excluded.predicted_home_goals,
        predicted_away_goals = excluded.predicted_away_goals,
        reason = excluded.reason,
        created_at = CURRENT_TIMESTAMP;
    `,
  );

  const insertMany = db.transaction(() => {
    for (const prediction of parsed.data.predictions) {
      insertPrediction.run(
        parsed.data.season,
        parsed.data.matchday,
        parsed.data.agentName,
        prediction.homeTeam,
        prediction.awayTeam,
        prediction.predictedOutcome,
        prediction.predictedHomeGoals ?? null,
        prediction.predictedAwayGoals ?? null,
        prediction.reason,
      );
    }
  });

  insertMany();

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
      WHERE season = ?
        AND matchday = ?
        AND agent_name = ?
      ORDER BY created_at DESC, id DESC;
    `,
    )
    .all(
      parsed.data.season,
      parsed.data.matchday,
      parsed.data.agentName,
    ) as PredictionRow[];

  if (predictions.length === 0) {
    return NextResponse.json(
      {
        error: "Failed to create predictions",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      predictions: predictions.map((prediction) => ({
        id: prediction.id,
        season: prediction.season,
        matchday: prediction.matchday,
        agentName: prediction.agent_name,
        homeTeam: prediction.home_team,
        awayTeam: prediction.away_team,
        predictedOutcome: prediction.predicted_outcome,
        predictedHomeGoals: prediction.predicted_home_goals,
        predictedAwayGoals: prediction.predicted_away_goals,
        reason: prediction.reason,
        createdAt: prediction.created_at,
      })),
    },
    { status: 201 },
  );
}
