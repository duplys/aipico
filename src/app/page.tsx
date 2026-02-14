import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>Bundesliga Matchday Predictions API</h1>
      <p>
        Submit predictions with <code>POST /api/predictions</code>.
      </p>

      <section className={styles.section}>
        <h2>Required JSON fields</h2>
        <ul>
          <li>
            <code>season</code> (string, e.g. <code>&quot;2025-26&quot;</code>)
          </li>
          <li>
            <code>matchday</code> (number from 1 to 34)
          </li>
          <li>
            <code>homeTeam</code> (string)
          </li>
          <li>
            <code>awayTeam</code> (string)
          </li>
          <li>
            <code>predictedOutcome</code> (<code>HOME_WIN | DRAW | AWAY_WIN</code>)
          </li>
        </ul>
        <p>
          Optional: <code>predictedHomeGoals</code> and <code>predictedAwayGoals</code>
          (if one is set, both must be set).
        </p>
      </section>

      <section className={styles.section}>
        <h2>Example request</h2>
        <pre>{`curl -X POST http://localhost:3000/api/predictions \\
  -H "Content-Type: application/json" \\
  -d '{
    "season": "2025-26",
    "matchday": 1,
    "homeTeam": "FC Bayern Munich",
    "awayTeam": "Borussia Dortmund",
    "predictedOutcome": "HOME_WIN",
    "predictedHomeGoals": 2,
    "predictedAwayGoals": 1
  }'`}</pre>
      </section>
    </main>
  );
}
