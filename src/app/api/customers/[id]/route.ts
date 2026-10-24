import { customerPatchSchema } from "@/domain/project";
import { handle, json, readJson } from "@/server/http";
import { getRepo, NotFoundError } from "@/server/repo";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const repo = await getRepo();
    const customer = await repo.getCustomer(id);
    if (!customer) throw new NotFoundError("הלקוח");
    const projects = await repo.listProjects({ customerId: id, archived: "all" });
    return json({ customer, projects });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const patch = await readJson(req, customerPatchSchema);
    return json({ customer: await (await getRepo()).updateCustomer(id, patch) });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    if (!(await (await getRepo()).deleteCustomer(id))) throw new NotFoundError("הלקוח");
    return json({ ok: true });
  });
}
