import { handle, json } from "@/server/http";
import { getRepo } from "@/server/repo";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    return json({ project: await (await getRepo()).duplicateProject(id) }, 201);
  });
}
