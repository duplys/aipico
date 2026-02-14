# aipico

Basic Next.js web application for posting German Bundesliga matchday predictions via API.

## Stack

- Next.js (App Router, TypeScript)
- PostgreSQL
- Docker Compose
- Caddy

## API

### POST `/api/predictions`

Creates a prediction record.

Request body:

```json
{
  "season": "2025-26",
  "matchday": 1,
  "homeTeam": "FC Bayern Munich",
  "awayTeam": "Borussia Dortmund",
  "predictedOutcome": "HOME_WIN",
  "predictedHomeGoals": 2,
  "predictedAwayGoals": 1
}
```

Rules:
- `matchday` must be between 1 and 34
- `predictedOutcome` must be one of `HOME_WIN`, `DRAW`, `AWAY_WIN`
- `predictedHomeGoals` and `predictedAwayGoals` are optional, but if one is set both must be set

Example:

```bash
curl -X POST http://localhost:3000/api/predictions \
  -H "Content-Type: application/json" \
  -d '{
    "season": "2025-26",
    "matchday": 1,
    "homeTeam": "FC Bayern Munich",
    "awayTeam": "Borussia Dortmund",
    "predictedOutcome": "HOME_WIN",
    "predictedHomeGoals": 2,
    "predictedAwayGoals": 1
  }'
```

## Local development

1. Start PostgreSQL (for example via Docker):

```bash
docker run --name aipico-db -e POSTGRES_DB=aipico -e POSTGRES_USER=aipico -e POSTGRES_PASSWORD=aipico -p 5432:5432 -d postgres:17-alpine
```

2. Install dependencies and run app:

```bash
npm install
DATABASE_URL=postgres://aipico:aipico@localhost:5432/aipico npm run dev
```

## Deploy with Docker Compose + Caddy

```bash
docker compose up -d --build
```

Optional domain (for automatic HTTPS through Caddy):

```bash
DOMAIN=your-domain.example docker compose up -d --build
```

