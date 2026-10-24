import type { Db } from "./types";
import { migrations } from "./migrations";

export async function migrate(db: Db): Promise<string[]> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  const done = new Set(
    (await db.query<{ id: string }>(`SELECT id FROM schema_migrations`)).map((r) => r.id),
  );
  const applied: string[] = [];
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    await db.transaction(async (tx) => {
      for (const stmt of m.sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
        await tx.query(stmt);
      }
      await tx.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [m.id]);
    });
    applied.push(m.id);
  }
  return applied;
}
