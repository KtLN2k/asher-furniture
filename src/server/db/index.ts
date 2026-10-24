import path from "node:path";
import type { Db } from "./types";
import { migrate } from "./migrate";
import { createPgliteDb } from "./pglite";
import { createPgDb } from "./pg";

export type { Db } from "./types";

/**
 * בחירת מנוע:
 *  - DATABASE_URL מוגדר  -> PostgreSQL אמיתי (Supabase / Docker / שרת) דרך `pg`.
 *  - אחרת               -> PGlite: PostgreSQL אמיתי (WASM) שרץ בתוך התהליך ושומר לתיקייה על הדיסק.
 * שתי האפשרויות מריצות את אותו SQL ואותן מיגרציות.
 */
export async function openDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  const db = url
    ? createPgDb(url)
    : await createPgliteDb(
        process.env.ASHER_DATA_DIR ?? path.join(process.cwd(), "data", "pglite"),
      );
  await migrate(db);
  return db;
}

const g = globalThis as unknown as { __asherDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__asherDb) {
    g.__asherDb = openDb().catch((err) => {
      g.__asherDb = undefined;
      throw err;
    });
  }
  return g.__asherDb;
}
