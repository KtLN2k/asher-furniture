import { Pool, type PoolClient } from "pg";
import type { Db } from "./types";

function wrapClient(client: Pick<PoolClient, "query">, pool: Pool, release?: () => void): Db {
  return {
    kind: "pg",
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await client.query(sql, params);
      return res.rows as T[];
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (release) return fn(wrapClient(client, pool, release));
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const out = await fn(wrapClient(c, pool, () => c.release()));
        await c.query("COMMIT");
        return out;
      } catch (err) {
        await c.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        c.release();
      }
    },
    async close() {
      if (!release) await pool.end();
    },
  };
}

export function createPgDb(connectionString: string): Db {
  const pool = new Pool({ connectionString, max: 5 });
  return wrapClient(pool, pool);
}
