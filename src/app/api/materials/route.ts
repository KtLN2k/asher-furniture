import { materialCreateSchema } from "@/domain/materials";
import { handle, json, readJson } from "@/server/http";
import { getRepo } from "@/server/repo";

export async function GET() {
  return handle(async () => json({ materials: await (await getRepo()).listMaterials() }));
}

export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, materialCreateSchema);
    return json({ material: await (await getRepo()).createMaterial(input) }, 201);
  });
}
