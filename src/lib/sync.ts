/**
 * העלאה חד-פעמית של הנתונים המקומיים (אפליקציה ארוזה) לשרת: לקוחות ואז פרויקטים
 * על התכנון המלא שלהם. פרויקט שכבר הועלה (לפי מזהה מקומי) לא יועלה שוב.
 * זה לא סנכרון דו-כיווני: אחרי ההעלאה עוברים לעבוד מול השרת.
 */
import type { Project } from "@/domain/project";

const UPLOADED_KEY = "asher:uploaded";

async function remote<T>(base: string, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(base + path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("אין חיבור לשרת. בדקו את הכתובת, את הרשת ואת הגדרות ה-CORS בשרת.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `השרת החזיר שגיאה (${res.status})`);
  return data as T;
}

export async function checkServer(base: string): Promise<{ ok: boolean }> {
  return remote<{ ok: boolean }>(base, "GET", "/api/health");
}

function uploadedMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(UPLOADED_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export interface UploadReport {
  customers: number;
  projects: number;
  skipped: number;
  errors: string[];
}

export async function uploadLocalData(base: string, onProgress?: (msg: string) => void): Promise<UploadReport> {
  const local = await import("./local-backend");
  const repo = await local.getLocalRepo();
  const done = uploadedMap();
  const report: UploadReport = { customers: 0, projects: 0, skipped: 0, errors: [] };
  const customerMap = new Map<string, string>();

  const customers = await repo.listCustomers();
  for (const c of customers) {
    if (done[`c:${c.id}`]) {
      customerMap.set(c.id, done[`c:${c.id}`]);
      continue;
    }
    try {
      onProgress?.(`מעלה לקוח: ${c.name}`);
      const { customer } = await remote<{ customer: { id: string } }>(base, "POST", "/api/customers", {
        name: c.name,
        phone: c.phone,
        address: c.address,
        notes: c.notes,
      });
      customerMap.set(c.id, customer.id);
      done[`c:${c.id}`] = customer.id;
      report.customers++;
    } catch (e) {
      report.errors.push(`לקוח ${c.name}: ${(e as Error).message}`);
    }
  }

  const summaries = await repo.listProjects({ archived: "all", limit: 200 });
  for (const s of summaries) {
    if (done[`p:${s.id}`]) {
      report.skipped++;
      continue;
    }
    const p = (await repo.getProject(s.id)) as Project | null;
    if (!p) continue;
    try {
      onProgress?.(`מעלה פרויקט: ${p.name}`);
      const { project } = await remote<{ project: { id: string } }>(base, "POST", "/api/projects", {
        name: p.name,
        customerId: p.customer ? (customerMap.get(p.customer.id) ?? null) : null,
        status: p.status,
        notes: p.notes,
      });
      const { schemaVersion: _v, ...design } = p.design;
      void _v;
      await remote(base, "PATCH", `/api/projects/${project.id}`, {
        design,
        wizardStep: p.wizardStep,
        archived: Boolean(p.archivedAt),
      });
      done[`p:${p.id}`] = project.id;
      report.projects++;
    } catch (e) {
      report.errors.push(`פרויקט ${p.name}: ${(e as Error).message}`);
    }
    localStorage.setItem(UPLOADED_KEY, JSON.stringify(done));
  }
  localStorage.setItem(UPLOADED_KEY, JSON.stringify(done));
  return report;
}
