import Link from "next/link";
import { notFound } from "next/navigation";

import { getMatchdayPredictions } from "@/lib/db";

import styles from "../../../page.module.css";

export const dynamic = "force-dynamic";

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

type ArchiveMatchdayPageProps = {
  params: Promise<{
    season: string;
    matchday: string;
  }>;
};

export default async function ArchiveMatchdayPage({
  params,
}: ArchiveMatchdayPageProps) {
  const { season, matchday } = await params;
  const parsedMatchday = Number(matchday);

  if (!Number.isInteger(parsedMatchday) || parsedMatchday < 1 || parsedMatchday > 34) {
    notFound();
  }

  const matchdayPredictions = await getMatchdayPredictions(season, parsedMatchday);

  if (!matchdayPredictions) {
    notFound();
  }

  const fixturesMap = new Map<
    string,
    {
      homeTeam: string;
      awayTeam: string;
      predictions: typeof matchdayPredictions.predictions;
    }
  >();
  const agents = new Set<string>();

  for (const prediction of matchdayPredictions.predictions) {
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
            Season {matchdayPredictions.season} · Matchday {matchdayPredictions.matchday}
          </p>
        </div>
        <nav className={styles.headerLinks}>
          <Link href="/" className={styles.docsLink}>
            Overview
          </Link>
          <Link href="/archive" className={styles.docsLink}>
            Archive
          </Link>
          <Link href="/docs" className={styles.docsLink}>
            Docs
          </Link>
        </nav>
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
          <h2>{matchdayPredictions.predictions.length}</h2>
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
