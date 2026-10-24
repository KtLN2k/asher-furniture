import { z } from "zod";
import { STATUS_KEYS } from "@/domain/catalog";
import { projectCreateSchema } from "@/domain/project";
import { handle, json, readJson } from "@/server/http";
import { getRepo } from "@/server/repo";

const querySchema = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(STATUS_KEYS).optional(),
  archived: z.enum(["exclude", "only", "all"]).optional(),
  customerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) return json({ error: { code: "validation", message: "פרמטרי חיפוש לא תקינים" } }, 400);
    const repo = await getRepo();
    return json({ projects: await repo.listProjects(parsed.data) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, projectCreateSchema);
    const repo = await getRepo();
    return json({ project: await repo.createProject(input) }, 201);
  });
}
