import { createPgliteDb } from "@/server/db/pglite";
import { migrate } from "@/server/db/migrate";
import { SqlRepository } from "@/server/repo/sql-repository";
import type { Db } from "@/server/db/types";

export async function memoryRepo(): Promise<{ db: Db; repo: SqlRepository }> {
  const db = await createPgliteDb();
  await migrate(db);
  return { db, repo: new SqlRepository(db) };
}
