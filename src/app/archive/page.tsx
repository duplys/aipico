import Link from "next/link";

import { listAvailableMatchdays } from "@/lib/db";

import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const matchdays = await listAvailableMatchdays();

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1>Archive</h1>
          <p>Browse predictions by season and matchday.</p>
        </div>
        <nav className={styles.headerLinks}>
          <Link href="/" className={styles.docsLink}>
            Overview
          </Link>
          <Link href="/docs" className={styles.docsLink}>
            Docs
          </Link>
        </nav>
      </header>

      {matchdays.length === 0 ? (
        <p>No archived matchdays available yet.</p>
      ) : (
        <section className={styles.fixturesGrid}>
          {matchdays.map(({ season, matchday }) => (
            <article
              key={`${season}-${matchday}`}
              className={styles.summaryCard}
            >
              <h2>
                Season {season} · Matchday {matchday}
              </h2>
              <p>
                <Link
                  href={`/archive/${encodeURIComponent(season)}/${matchday}`}
                  className={styles.docsLink}
                >
                  Open predictions
                </Link>
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
