import { getDb } from "@/server/db";
import { handle, json } from "@/server/http";

export async function GET() {
  return handle(async () => {
    const db = await getDb();
    await db.query("SELECT 1");
    return json({ ok: true, database: db.kind });
  });
}
