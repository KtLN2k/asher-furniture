import { settingsPatchSchema } from "@/domain/project";
import { handle, json, readJson } from "@/server/http";
import { getRepo } from "@/server/repo";

export async function GET() {
  return handle(async () => json({ settings: await (await getRepo()).getSettings() }));
}

export async function PUT(req: Request) {
  return handle(async () => {
    const patch = await readJson(req, settingsPatchSchema);
    return json({ settings: await (await getRepo()).updateSettings(patch) });
  });
}
