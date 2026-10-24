/**
 * אחסון מקומי במכשיר לאפליקציה הארוזה: אותו SqlRepository ואותן מיגרציות שמשרתים
 * את ה-API, רצים כאן על PGlite (PostgreSQL ב-WASM) שנשמר ב-IndexedDB של המכשיר.
 * המודול נטען דינמית רק כשאין שרת, כך שהאתר הרגיל לא נושא אותו.
 *
 * `dispatch` משקף את נתיבי ה-API (src/app/api/**) אחד לאחד, כדי ש-`api.ts` יישאר זהה.
 */
import { z } from "zod";
import { STATUS_KEYS } from "@/domain/catalog";
import { limitsSchema } from "@/domain/limits";
import { materialCreateSchema, materialPatchSchema } from "@/domain/materials";
import {
  customerInputSchema,
  customerPatchSchema,
  projectCreateSchema,
  projectPatchSchema,
  settingsPatchSchema,
} from "@/domain/project";
import type { Db } from "@/server/db/types";
import { migrate } from "@/server/db/migrate";
import { SqlRepository } from "@/server/repo/sql-repository";
import { ConflictError, NotFoundError, ValidationError, type Repository } from "@/server/repo/types";

export const LOCAL_DB_NAME = "asher-furniture";

export class LocalHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public current?: unknown,
  ) {
    super(message);
  }
}

async function openLocalDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  type Runner = { query: InstanceType<typeof PGlite>["query"] };
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/pglite";
  const [wasmModule, fsBundle] = await Promise.all([
    WebAssembly.compileStreaming(fetch(`${base}/pglite.wasm`)),
    fetch(`${base}/pglite.data`).then((r) => r.blob()),
  ]);
  const client = new PGlite(`idb://${LOCAL_DB_NAME}`, { pgliteWasmModule: wasmModule, fsBundle, relaxedDurability: false });
  await client.waitReady;

  const wrap = (runner: Runner, inTx: boolean): Db => ({
    kind: "pglite",
    async query<T>(sql: string, params: unknown[] = []) {
      return (await runner.query<T>(sql, params)).rows;
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (inTx) return fn(wrap(runner, true));
      return client.transaction((tx) => fn(wrap(tx as Runner, true)));
    },
    async close() {
      if (!inTx) await client.close();
    },
  });
  return wrap(client, false);
}

let repoPromise: Promise<Repository> | null = null;

export function getLocalRepo(): Promise<Repository> {
  if (!repoPromise) {
    repoPromise = (async () => {
      const db = await openLocalDb();
      await migrate(db);
      return new SqlRepository(db);
    })().catch((err) => {
      repoPromise = null;
      throw err;
    });
  }
  return repoPromise;
}

const listQuerySchema = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(STATUS_KEYS).optional(),
  archived: z.enum(["exclude", "only", "all"]).optional(),
  customerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "הנתונים אינם תקינים");
  return parsed.data;
}

const patchBody = projectPatchSchema.extend({ baseRevision: z.number().int().min(1).optional() });

async function route(repo: Repository, method: string, pathname: string, search: URLSearchParams, body: unknown): Promise<unknown> {
  const seg = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [res, id, action] = seg;
  const notFound = (what: string) => {
    throw new NotFoundError(what);
  };

  if (res === "projects") {
    if (!id) {
      if (method === "GET") return { projects: await repo.listProjects(parse(listQuerySchema, Object.fromEntries(search))) };
      if (method === "POST") return { project: await repo.createProject(parse(projectCreateSchema, body)) };
    } else if (action === "duplicate" && method === "POST") {
      return { project: await repo.duplicateProject(id) };
    } else if (!action) {
      if (method === "GET") return { project: (await repo.getProject(id)) ?? notFound("הפרויקט") };
      if (method === "PATCH") {
        const { baseRevision, ...patch } = parse(patchBody, body);
        return { project: await repo.updateProject(id, patch, baseRevision) };
      }
      if (method === "DELETE") return (await repo.deleteProject(id)) ? { ok: true } : notFound("הפרויקט");
    }
  }
  if (res === "customers") {
    if (!id) {
      if (method === "GET") return { customers: await repo.listCustomers(search.get("q")?.slice(0, 100) ?? undefined) };
      if (method === "POST") return { customer: await repo.createCustomer(parse(customerInputSchema, body)) };
    } else if (!action) {
      if (method === "GET") {
        const customer = (await repo.getCustomer(id)) ?? notFound("הלקוח");
        return { customer, projects: await repo.listProjects({ customerId: id, archived: "all" }) };
      }
      if (method === "PATCH") return { customer: await repo.updateCustomer(id, parse(customerPatchSchema, body)) };
      if (method === "DELETE") return (await repo.deleteCustomer(id)) ? { ok: true } : notFound("הלקוח");
    }
  }
  if (res === "settings" && !id) {
    if (method === "GET") return { settings: await repo.getSettings() };
    if (method === "PUT") return { settings: await repo.updateSettings(parse(settingsPatchSchema, body)) };
  }
  if (res === "materials") {
    if (!id) {
      if (method === "GET") return { materials: await repo.listMaterials() };
      if (method === "POST") return { material: await repo.createMaterial(parse(materialCreateSchema, body)) };
    } else if (!action) {
      if (method === "PATCH") return { material: await repo.updateMaterial(id, parse(materialPatchSchema, body)) };
      if (method === "DELETE") return (await repo.deleteMaterial(id)) ? { ok: true } : notFound("הפריט");
    }
  }
  if (res === "limits" && !id) {
    if (method === "GET") return { limits: await repo.getLimits() };
    if (method === "PUT") return { limits: await repo.updateLimits(parse(limitsSchema, body)) };
  }
  if (res === "health") return { ok: true, storage: "device" };
  throw new LocalHttpError(404, "not_found", "הנתיב לא קיים");
}

/** מבצע קריאת API מול האחסון המקומי; זורק LocalHttpError במבנה שתואם לתשובות השרת. */
export async function dispatch<T>(method: string, url: string, body?: unknown): Promise<T> {
  const u = new URL(url, "http://local");
  const repo = await getLocalRepo();
  try {
    // JSON round-trip: אותו ייצוג (תאריכים כמחרוזות) כמו מהשרת
    return JSON.parse(JSON.stringify(await route(repo, method, u.pathname, u.searchParams, body))) as T;
  } catch (err) {
    if (err instanceof LocalHttpError) throw err;
    if (err instanceof ValidationError) throw new LocalHttpError(400, "validation", err.message);
    if (err instanceof NotFoundError) throw new LocalHttpError(404, "not_found", err.message);
    if (err instanceof ConflictError) throw new LocalHttpError(409, "conflict", err.message, JSON.parse(JSON.stringify(err.current)));
    console.error(err);
    throw new LocalHttpError(500, "server", "אירעה תקלה באחסון המקומי. נסו שוב.");
  }
}
