import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Db } from "./types";

type Runner = Pick<PGlite | Transaction, "query">;

function wrap(runner: Runner, root: PGlite, inTx: boolean): Db {
  return {
    kind: "pglite",
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await runner.query<T>(sql, params);
      return res.rows;
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (inTx) return fn(wrap(runner, root, true));
      return root.transaction((tx) => fn(wrap(tx, root, true)));
    },
    async close() {
      if (!inTx) await root.close();
    },
  };
}

/** dataDir ריק או "memory://" = זיכרון בלבד (לבדיקות). */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const client = new PGlite(dataDir && dataDir !== "memory://" ? dataDir : undefined);
  await client.waitReady;
  return wrap(client, client, false);
}
