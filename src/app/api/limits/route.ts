import { limitsSchema } from "@/domain/limits";
import { handle, json, readJson } from "@/server/http";
import { getRepo } from "@/server/repo";

export async function GET() {
  return handle(async () => json({ limits: await (await getRepo()).getLimits() }));
}

export async function PUT(req: Request) {
  return handle(async () => {
    const limits = await readJson(req, limitsSchema);
    return json({ limits: await (await getRepo()).updateLimits(limits) });
  });
}
