import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createPgDb } from "@/server/db/pg";
import { migrate } from "@/server/db/migrate";
import { SqlRepository } from "@/server/repo/sql-repository";
import { ConflictError } from "@/server/repo/types";
import type { Db } from "@/server/db/types";

/**
 * מאמת שהדרייבר של PostgreSQL אמיתי (`pg`, מה שרץ עם DATABASE_URL) עובד עם אותה שכבת repository.
 * שרת Postgres מדומה (פרוטוקול wire) מסופק על ידי pglite-socket.
 */
let server: PGLiteSocketServer;
let backing: PGlite;
let db: Db;
let repo: SqlRepository;
const PORT = 54329;

beforeAll(async () => {
  backing = await PGlite.create();
  server = new PGLiteSocketServer({ db: backing, port: PORT, host: "127.0.0.1" });
  await server.start();
  db = createPgDb(`postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`);
  await migrate(db);
  repo = new SqlRepository(db);
});

afterAll(async () => {
  await db?.close();
  await server?.stop();
  await backing?.close();
});

describe("דרייבר pg (PostgreSQL אמיתי)", () => {
  it("מריץ מיגרציות, יוצר ושומר פרויקט עם לקוח", async () => {
    expect(db.kind).toBe("pg");
    const c = await repo.createCustomer({ name: "לקוח pg", phone: "050", address: "", notes: "" });
    const p = await repo.createProject({ name: "פרויקט pg", customerId: c.id });
    const u = await repo.updateProject(p.id, { design: { category: "wardrobes" } }, p.revision);
    expect(u.revision).toBe(2);
    expect(u.design.category).toBe("wardrobes");
    expect((await repo.listProjects({ q: "pg" })).length).toBe(1);
    expect((await repo.listCustomers()).find((x) => x.id === c.id)?.projectCount).toBe(1);
  });

  it("מבטל טרנזקציה בשגיאה ומזהה התנגשות", async () => {
    const p = await repo.createProject({ name: "טרנזקציה" });
    await repo.updateProject(p.id, { name: "א" }, 1);
    await expect(repo.updateProject(p.id, { name: "ב" }, 1)).rejects.toBeInstanceOf(ConflictError);
    expect((await repo.getProject(p.id))?.name).toBe("א");
    const copy = await repo.duplicateProject(p.id);
    expect(copy.name).toBe("א — עותק");
  });
});
