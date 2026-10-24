import type {
  Customer,
  CustomerInput,
  CustomerPatch,
  CustomerWithCount,
  Project,
  ProjectCreateInput,
  ProjectListQuery,
  ProjectPatch,
  ProjectSummary,
  ShopSettings,
} from "@/domain/project";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public current?: Project,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

async function request<T>(method: string, url: string, body?: unknown, opts?: { signal?: AbortSignal; keepalive?: boolean }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: opts?.signal,
      keepalive: opts?.keepalive,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.", 0, "network");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(e?.message ?? "אירעה תקלה. נסו שוב.", res.status, e?.code ?? "server", e?.current);
  }
  return data as T;
}

function qs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  listProjects: (q: ProjectListQuery = {}, signal?: AbortSignal) =>
    request<{ projects: ProjectSummary[] }>("GET", `/api/projects${qs({ ...q })}`, undefined, { signal }).then((r) => r.projects),
  getProject: (id: string, signal?: AbortSignal) =>
    request<{ project: Project }>("GET", `/api/projects/${id}`, undefined, { signal }).then((r) => r.project),
  createProject: (input: ProjectCreateInput) =>
    request<{ project: Project }>("POST", "/api/projects", input).then((r) => r.project),
  patchProject: (id: string, patch: ProjectPatch, baseRevision?: number, keepalive?: boolean) =>
    request<{ project: Project }>("PATCH", `/api/projects/${id}`, { ...patch, baseRevision }, { keepalive }).then((r) => r.project),
  duplicateProject: (id: string) =>
    request<{ project: Project }>("POST", `/api/projects/${id}/duplicate`).then((r) => r.project),
  deleteProject: (id: string) => request<{ ok: true }>("DELETE", `/api/projects/${id}`),

  listCustomers: (q?: string, signal?: AbortSignal) =>
    request<{ customers: CustomerWithCount[] }>("GET", `/api/customers${qs({ q })}`, undefined, { signal }).then((r) => r.customers),
  getCustomer: (id: string, signal?: AbortSignal) =>
    request<{ customer: Customer; projects: ProjectSummary[] }>("GET", `/api/customers/${id}`, undefined, { signal }),
  createCustomer: (input: Partial<CustomerInput> & { name: string }) =>
    request<{ customer: Customer }>("POST", "/api/customers", input).then((r) => r.customer),
  patchCustomer: (id: string, patch: CustomerPatch) =>
    request<{ customer: Customer }>("PATCH", `/api/customers/${id}`, patch).then((r) => r.customer),
  deleteCustomer: (id: string) => request<{ ok: true }>("DELETE", `/api/customers/${id}`),

  getSettings: () => request<{ settings: ShopSettings }>("GET", "/api/settings").then((r) => r.settings),
  updateSettings: (patch: Partial<ShopSettings>) =>
    request<{ settings: ShopSettings }>("PUT", "/api/settings", patch).then((r) => r.settings),
};
