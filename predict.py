#!/usr/bin/env python3
"""
Bundesliga matchday prediction script.

Reads strategy.md, asks Claude for predictions, and posts them to the aipico API.

Required environment variables:
  ANTHROPIC_API_KEY   - Anthropic API key
  AIPICO_API_URL      - Base URL of the web app (default: http://localhost:3000)
  AGENT_NAME          - Name to identify this agent (default: Claude-Predictor)

Optional environment variables:
  STRATEGY_FILE       - Path to strategy file (default: strategy.md)

Cron example (run every Friday at 08:00):
  0 8 * * 5 cd /path/to/aipico && python3 predict.py >> /var/log/predict.log 2>&1
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path


ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
AIPICO_API_URL = os.environ.get("AIPICO_API_URL", "http://localhost:3000")
AGENT_NAME = os.environ.get("AGENT_NAME", "Claude-Predictor")
STRATEGY_FILE = os.environ.get("STRATEGY_FILE", "strategy.md")
MODEL = "claude-sonnet-4-6"


def read_strategy() -> str:
    path = Path(STRATEGY_FILE)
    if not path.exists():
        raise FileNotFoundError(f"Strategy file not found: {STRATEGY_FILE}")
    return path.read_text(encoding="utf-8")


def call_claude(prompt: str) -> str:
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    payload = json.dumps({
        "model": MODEL,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            body = json.loads(resp.read())
            return body["content"][0]["text"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Anthropic API error {e.code}: {e.read().decode()}") from e


def post_predictions(payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{AIPICO_API_URL}/api/predictions",
        data=data,
        headers={"content-type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"API error {e.code}: {e.read().decode()}") from e


def extract_json(text: str) -> str:
    """Strip markdown code fences if Claude wrapped the JSON in them."""
    text = text.strip()
    if text.startswith("```"):
        # Remove opening fence (```json or ```)
        text = text[text.index("\n") + 1:]
        # Remove closing fence
        if "```" in text:
            text = text[:text.rindex("```")]
    return text.strip()


def build_prompt(strategy: str) -> str:
    return f"""You are a Bundesliga football prediction agent. Your prediction strategy is described below.

--- STRATEGY ---
{strategy}
--- END STRATEGY ---

Based on this strategy, provide predictions for the upcoming Bundesliga matchday.

Respond ONLY with a single valid JSON object — no explanation, no markdown, no text outside the JSON.
Use this exact format:

{{
  "season": "<season string, e.g. 2025-26>",
  "matchday": <integer 1-34>,
  "predictions": [
    {{
      "homeTeam": "<home team name>",
      "awayTeam": "<away team name>",
      "predictedOutcome": "<HOME_WIN|DRAW|AWAY_WIN>",
      "predictedHomeGoals": <integer 0-20>,
      "predictedAwayGoals": <integer 0-20>,
      "reason": "<concise reasoning, max a few sentences>"
    }}
  ]
}}

Rules:
- Include every fixture of the matchday (typically 9 games).
- predictedOutcome must be exactly HOME_WIN, DRAW, or AWAY_WIN — nothing else.
- predictedHomeGoals and predictedAwayGoals must both be present (both integers) or both omitted.
- reason is required for every prediction.
- Use full official team names (e.g. "FC Bayern München", "Borussia Dortmund").
"""


def main() -> None:
    print(f"Reading strategy from '{STRATEGY_FILE}'...")
    strategy = read_strategy()

    print("Calling Claude for predictions...")
    raw_response = call_claude(build_prompt(strategy))

    print("Parsing response...")
    try:
        data = json.loads(extract_json(raw_response))
    except json.JSONDecodeError as e:
        print("Failed to parse Claude response as JSON.", file=sys.stderr)
        print("Raw response:", raw_response, file=sys.stderr)
        raise RuntimeError("Invalid JSON from Claude") from e

    data["agentName"] = AGENT_NAME

    matchday = data.get("matchday", "?")
    season = data.get("season", "?")
    count = len(data.get("predictions", []))
    print(f"Posting {count} prediction(s) for {season} matchday {matchday} as '{AGENT_NAME}'...")

    result = post_predictions(data)

    posted = len(result.get("predictions", []))
    print(f"Done. {posted} prediction(s) stored successfully.")


if __name__ == "__main__":
    main()
