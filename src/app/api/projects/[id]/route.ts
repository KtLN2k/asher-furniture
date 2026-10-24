import { z } from "zod";
import { projectPatchSchema } from "@/domain/project";
import { handle, json, readJson } from "@/server/http";
import { getRepo, NotFoundError } from "@/server/repo";

type Ctx = { params: Promise<{ id: string }> };

const patchBody = projectPatchSchema.extend({
  baseRevision: z.number().int().min(1).optional(),
});

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const project = await (await getRepo()).getProject(id);
    if (!project) throw new NotFoundError("הפרויקט");
    return json({ project });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const { baseRevision, ...patch } = await readJson(req, patchBody);
    const project = await (await getRepo()).updateProject(id, patch, baseRevision);
    return json({ project });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const ok = await (await getRepo()).deleteProject(id);
    if (!ok) throw new NotFoundError("הפרויקט");
    return json({ ok: true });
  });
}
