import { getDb } from "../db";
import { SqlRepository } from "./sql-repository";
import type { Repository } from "./types";

export * from "./types";

export async function getRepo(): Promise<Repository> {
  return new SqlRepository(await getDb());
}
