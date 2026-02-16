import { NextResponse } from "next/server";
import { z } from "zod";

import { ensurePredictionsTable, getDb } from "@/lib/db";

export const runtime = "nodejs";

const createPredictionSchema = z
  .object({
    season: z.string().min(4).max(20),
    matchday: z.number().int().min(1).max(34),
    homeTeam: z.string().trim().min(1).max(80),
    awayTeam: z.string().trim().min(1).max(80),
    predictedOutcome: z.enum(["HOME_WIN", "DRAW", "AWAY_WIN"]),
    predictedHomeGoals: z.number().int().min(0).max(20).optional(),
    predictedAwayGoals: z.number().int().min(0).max(20).optional(),
  })
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
  );

type PredictionRow = {
  id: number;
  season: string;
  matchday: number;
  home_team: string;
  away_team: string;
  predicted_outcome: "HOME_WIN" | "DRAW" | "AWAY_WIN";
  predicted_home_goals: number | null;
  predicted_away_goals: number | null;
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

  const insertResult = db
    .prepare(
      `
      INSERT INTO predictions (
        season,
        matchday,
        home_team,
        away_team,
        predicted_outcome,
        predicted_home_goals,
        predicted_away_goals
      )
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `,
    )
    .run(
      parsed.data.season,
      parsed.data.matchday,
      parsed.data.homeTeam,
      parsed.data.awayTeam,
      parsed.data.predictedOutcome,
      parsed.data.predictedHomeGoals ?? null,
      parsed.data.predictedAwayGoals ?? null,
    );

  const prediction = db
    .prepare(
      `
      SELECT
        id,
        season,
        matchday,
        home_team,
        away_team,
        predicted_outcome,
        predicted_home_goals,
        predicted_away_goals,
        created_at
      FROM predictions
      WHERE id = ?;
    `,
    )
    .get(insertResult.lastInsertRowid as number) as PredictionRow | undefined;

  if (!prediction) {
    return NextResponse.json(
      {
        error: "Failed to create prediction",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      prediction: {
        id: prediction.id,
        season: prediction.season,
        matchday: prediction.matchday,
        homeTeam: prediction.home_team,
        awayTeam: prediction.away_team,
        predictedOutcome: prediction.predicted_outcome,
        predictedHomeGoals: prediction.predicted_home_goals,
        predictedAwayGoals: prediction.predicted_away_goals,
        createdAt: prediction.created_at,
      },
    },
    { status: 201 },
  );
}
