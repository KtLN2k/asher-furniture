import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const uid = (label: string) => `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export async function seedProject(
  request: APIRequestContext,
  body: { name: string; status?: string; customerId?: string; category?: string; wizardStep?: number },
) {
  const res = await request.post("/api/projects", { data: { name: body.name, status: body.status, customerId: body.customerId } });
  const { project } = await res.json();
  if (body.category || body.wizardStep) {
    await request.patch(`/api/projects/${project.id}`, {
      data: { design: body.category ? { category: body.category } : undefined, wizardStep: body.wizardStep },
    });
  }
  return project as { id: string; name: string };
}

export async function seedCustomer(request: APIRequestContext, name: string, phone = "") {
  const res = await request.post("/api/customers", { data: { name, phone } });
  return (await res.json()).customer as { id: string; name: string };
}

export const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved");

export function projectIdFromUrl(page: Page): string {
  const m = page.url().match(/\/projects\/([0-9a-f-]{36})\//);
  if (!m) throw new Error(`no project id in ${page.url()}`);
  return m[1];
}

export const card = (page: Page, name: string) => page.getByTestId("project-card").filter({ hasText: name });
