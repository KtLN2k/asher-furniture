import { customerInputSchema } from "@/domain/project";
import { handle, json, readJson } from "@/server/http";
import { getRepo } from "@/server/repo";

export async function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    return json({ customers: await (await getRepo()).listCustomers(q?.slice(0, 100)) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const input = await readJson(req, customerInputSchema);
    return json({ customer: await (await getRepo()).createCustomer(input) }, 201);
  });
}
