# Copilot Instructions for `aipico`

## Build, Test, and Lint

- Install deps: `npm install`
- Run dev server: `npm run dev`
- Lint: `npm run lint`
- Build: `npm run build`
- Start production app: `npm run start`

There is no test suite configured yet, so no single-test command exists.

## High-Level Architecture

- Next.js App Router app in `src/app`.
- API endpoint for prediction submission: `POST /api/predictions` in `src/app/api/predictions/route.ts`.
- SQLite access layer in `src/lib/db.ts` using `better-sqlite3` and lazy table initialization (`ensurePredictionsTable`).
- Prediction records are stored in `predictions` table (created automatically if missing) with matchday/outcome constraints.
- SQLite file defaults to `data/aipico.sqlite` and can be overridden with `SQLITE_PATH`.

## Key Conventions

- Keep API routes on Node runtime (`export const runtime = "nodejs"`) when using `better-sqlite3`.
- Validate request payloads with `zod` before DB operations and return `400` with validation issues.
- `predictedOutcome` must remain one of `HOME_WIN | DRAW | AWAY_WIN`.
- If goal predictions are provided, both `predictedHomeGoals` and `predictedAwayGoals` must be set together.
- `next.config.ts` uses `output: "standalone"` for Docker production images.
