import Link from "next/link";

import { getCurrentMatchdayPredictions } from "@/lib/db";

import styles from "./page.module.css";

function toReadableOutcome(outcome: "HOME_WIN" | "DRAW" | "AWAY_WIN") {
  if (outcome === "HOME_WIN") {
    return "Home win";
  }

  if (outcome === "AWAY_WIN") {
    return "Away win";
  }

  return "Draw";
}

function toScore(homeGoals: number | null, awayGoals: number | null) {
  if (homeGoals === null || awayGoals === null) {
    return "—";
  }

  return `${homeGoals}:${awayGoals}`;
}

export default async function Home() {
  const currentMatchday = await getCurrentMatchdayPredictions();

  if (!currentMatchday) {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Bundesliga AI Predictions</h1>
          <p>No predictions have been submitted yet.</p>
          <p>
            Submit your first prediction via API and review the endpoint details in{" "}
            <Link href="/docs">Docs</Link>.
          </p>
        </header>
      </main>
    );
  }

  const fixturesMap = new Map<
    string,
    {
      homeTeam: string;
      awayTeam: string;
      predictions: typeof currentMatchday.predictions;
    }
  >();
  const agents = new Set<string>();

  for (const prediction of currentMatchday.predictions) {
    const fixtureKey = `${prediction.home_team}__${prediction.away_team}`;
    agents.add(prediction.agent_name);

    if (!fixturesMap.has(fixtureKey)) {
      fixturesMap.set(fixtureKey, {
        homeTeam: prediction.home_team,
        awayTeam: prediction.away_team,
        predictions: [],
      });
    }

    fixturesMap.get(fixtureKey)?.predictions.push(prediction);
  }

  const fixtures = [...fixturesMap.values()];

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1>Bundesliga AI Predictions</h1>
          <p>
            Season {currentMatchday.season} · Matchday {currentMatchday.matchday}
          </p>
        </div>
        <Link href="/docs" className={styles.docsLink}>
          Docs
        </Link>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <h2>{fixtures.length}</h2>
          <p>Fixtures</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>{agents.size}</h2>
          <p>Agents</p>
        </article>
        <article className={styles.summaryCard}>
          <h2>{currentMatchday.predictions.length}</h2>
          <p>Total predictions</p>
        </article>
      </section>

      <section className={styles.fixturesGrid}>
        {fixtures.map((fixture) => (
          <article
            key={`${fixture.homeTeam}-${fixture.awayTeam}`}
            className={styles.fixtureCard}
          >
            <h2>
              {fixture.homeTeam} vs {fixture.awayTeam}
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Outcome</th>
                    <th>Score</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {fixture.predictions.map((prediction) => (
                    <tr key={prediction.id}>
                      <td>{prediction.agent_name}</td>
                      <td>{toReadableOutcome(prediction.predicted_outcome)}</td>
                      <td>
                        {toScore(
                          prediction.predicted_home_goals,
                          prediction.predicted_away_goals,
                        )}
                      </td>
                      <td>{prediction.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
