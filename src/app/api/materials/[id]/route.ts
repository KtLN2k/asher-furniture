import { materialPatchSchema } from "@/domain/materials";
import { handle, json, readJson } from "@/server/http";
import { getRepo, NotFoundError } from "@/server/repo";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const patch = await readJson(req, materialPatchSchema);
    return json({ material: await (await getRepo()).updateMaterial(id, patch) });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    if (!(await (await getRepo()).deleteMaterial(id))) throw new NotFoundError("הפריט");
    return json({ ok: true });
  });
}
