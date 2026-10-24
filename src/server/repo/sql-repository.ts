import { randomUUID } from "node:crypto";
import type { Db } from "../db/types";
import { emptyDesign, mergeDesign, type FurnitureDesign } from "@/domain/design";
import type { CategoryKey, ProjectStatus } from "@/domain/catalog";
import {
  settingsSchema,
  type Customer,
  type CustomerInput,
  type CustomerPatch,
  type CustomerWithCount,
  type Project,
  type ProjectCreateInput,
  type ProjectListQuery,
  type ProjectPatch,
  type ProjectSummary,
  type ShopSettings,
} from "@/domain/project";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type Repository,
} from "./types";

const iso = (v: unknown): string => (v instanceof Date ? v : new Date(v as string)).toISOString();
const isoOrNull = (v: unknown): string | null => (v == null ? null : iso(v));

type Row = Record<string, unknown>;

const PROJECT_SELECT = `
SELECT p.id, p.name, p.status, p.notes, p.thumbnail, p.wizard_step, p.revision,
       p.archived_at, p.created_at, p.updated_at,
       f.id AS furniture_id, f.category, f.spec,
       c.id AS c_id, c.name AS c_name, c.phone AS c_phone, c.address AS c_address
FROM projects p
LEFT JOIN furniture_items f ON f.project_id = p.id AND f.position = 0
LEFT JOIN customers c ON c.id = p.customer_id`;

function toSummary(r: Row): ProjectSummary {
  return {
    id: r.id as string,
    name: r.name as string,
    status: r.status as ProjectStatus,
    category: (r.category as CategoryKey | null) ?? null,
    customer: r.c_id
      ? {
          id: r.c_id as string,
          name: r.c_name as string,
          phone: r.c_phone as string,
          address: r.c_address as string,
        }
      : null,
    thumbnail: (r.thumbnail as string | null) ?? null,
    wizardStep: r.wizard_step as number,
    archivedAt: isoOrNull(r.archived_at),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    revision: r.revision as number,
  };
}

function toProject(r: Row): Project {
  const spec = (r.spec as Partial<FurnitureDesign> | null) ?? {};
  return {
    ...toSummary(r),
    notes: r.notes as string,
    furnitureId: r.furniture_id as string,
    design: { ...emptyDesign(), ...spec, category: (r.category as CategoryKey | null) ?? null },
  };
}

function toCustomer(r: Row): Customer {
  return {
    id: r.id as string,
    name: r.name as string,
    phone: r.phone as string,
    address: r.address as string,
    notes: r.notes as string,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export class SqlRepository implements Repository {
  constructor(private readonly db: Db) {}

  async listProjects(query: ProjectListQuery = {}): Promise<ProjectSummary[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const q = query.q?.trim();
    if (q) {
      params.push(likePattern(q));
      where.push(`(p.name ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    if (query.status) {
      params.push(query.status);
      where.push(`p.status = $${params.length}`);
    }
    if (query.customerId) {
      params.push(query.customerId);
      where.push(`p.customer_id = $${params.length}`);
    }
    const archived = query.archived ?? "exclude";
    if (archived === "exclude") where.push(`p.archived_at IS NULL`);
    if (archived === "only") where.push(`p.archived_at IS NOT NULL`);
    let sql = PROJECT_SELECT;
    if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
    sql += ` ORDER BY p.updated_at DESC, p.id`;
    if (query.limit) {
      params.push(query.limit);
      sql += ` LIMIT $${params.length}`;
    }
    return (await this.db.query<Row>(sql, params)).map(toSummary);
  }

  async getProject(id: string): Promise<Project | null> {
    return this.loadProject(this.db, id);
  }

  private async loadProject(db: Db, id: string): Promise<Project | null> {
    const rows = await db.query<Row>(`${PROJECT_SELECT} WHERE p.id = $1`, [id]);
    return rows[0] ? toProject(rows[0]) : null;
  }

  private async assertCustomer(db: Db, customerId: string) {
    const rows = await db.query(`SELECT 1 FROM customers WHERE id = $1`, [customerId]);
    if (!rows.length) throw new ValidationError("הלקוח שנבחר לא קיים");
  }

  async createProject(input: ProjectCreateInput): Promise<Project> {
    const id = randomUUID();
    const furnitureId = randomUUID();
    return this.db.transaction(async (tx) => {
      if (input.customerId) await this.assertCustomer(tx, input.customerId);
      await tx.query(
        `INSERT INTO projects (id, name, customer_id, status, notes) VALUES ($1,$2,$3,$4,$5)`,
        [id, input.name, input.customerId ?? null, input.status ?? "draft", input.notes ?? ""],
      );
      await tx.query(
        `INSERT INTO furniture_items (id, project_id, position, category, spec) VALUES ($1,$2,0,NULL,$3::jsonb)`,
        [furnitureId, id, JSON.stringify(emptyDesign())],
      );
      return (await this.loadProject(tx, id))!;
    });
  }

  async updateProject(id: string, patch: ProjectPatch, baseRevision?: number): Promise<Project> {
    return this.db.transaction(async (tx) => {
      const locked = await tx.query<{ revision: number }>(
        `SELECT revision FROM projects WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!locked.length) throw new NotFoundError("הפרויקט");
      if (baseRevision !== undefined && locked[0].revision !== baseRevision) {
        throw new ConflictError((await this.loadProject(tx, id))!);
      }

      const sets: string[] = [];
      const params: unknown[] = [id];
      const set = (col: string, value: unknown) => {
        params.push(value);
        sets.push(`${col} = $${params.length}`);
      };
      if (patch.name !== undefined) set("name", patch.name);
      if (patch.status !== undefined) set("status", patch.status);
      if (patch.notes !== undefined) set("notes", patch.notes);
      if (patch.wizardStep !== undefined) set("wizard_step", patch.wizardStep);
      if (patch.customerId !== undefined) {
        if (patch.customerId) await this.assertCustomer(tx, patch.customerId);
        set("customer_id", patch.customerId);
      }
      if (patch.archived !== undefined) {
        sets.push(patch.archived ? `archived_at = COALESCE(archived_at, now())` : `archived_at = NULL`);
      }

      if (patch.design && Object.keys(patch.design).length) {
        const rows = await tx.query<Row>(
          `SELECT id, spec FROM furniture_items WHERE project_id = $1 AND position = 0 FOR UPDATE`,
          [id],
        );
        const base = { ...emptyDesign(), ...((rows[0]?.spec as Partial<FurnitureDesign>) ?? {}) };
        const merged = mergeDesign(base, patch.design);
        await tx.query(
          `UPDATE furniture_items SET spec = $2::jsonb, category = $3, updated_at = now() WHERE id = $1`,
          [rows[0].id, JSON.stringify(merged), merged.category ?? null],
        );
      }

      await tx.query(
        `UPDATE projects SET ${[...sets, "revision = revision + 1", "updated_at = now()"].join(", ")} WHERE id = $1`,
        params,
      );
      return (await this.loadProject(tx, id))!;
    });
  }

  async duplicateProject(id: string): Promise<Project> {
    return this.db.transaction(async (tx) => {
      const src = await this.loadProject(tx, id);
      if (!src) throw new NotFoundError("הפרויקט");
      const newId = randomUUID();
      await tx.query(
        `INSERT INTO projects (id, name, customer_id, status, notes, thumbnail, wizard_step)
         SELECT $2, left(name, 100) || ' — עותק', customer_id, 'draft', notes, thumbnail, wizard_step
         FROM projects WHERE id = $1`,
        [id, newId],
      );
      const items = await tx.query<Row>(
        `SELECT id, position, category, spec FROM furniture_items WHERE project_id = $1 ORDER BY position`,
        [id],
      );
      for (const item of items) {
        const newItemId = randomUUID();
        await tx.query(
          `INSERT INTO furniture_items (id, project_id, position, category, spec) VALUES ($1,$2,$3,$4,$5::jsonb)`,
          [newItemId, newId, item.position, item.category, JSON.stringify(item.spec)],
        );
        const facades = await tx.query<Row>(
          `SELECT position, target, material_id, spec FROM facades WHERE furniture_id = $1`,
          [item.id],
        );
        for (const f of facades) {
          await tx.query(
            `INSERT INTO facades (id, furniture_id, position, target, material_id, spec) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
            [randomUUID(), newItemId, f.position, f.target, f.material_id, JSON.stringify(f.spec)],
          );
        }
        const parts = await tx.query<Row>(
          `SELECT kind, label, material_id, cut_dimensions, spec FROM parts WHERE furniture_id = $1`,
          [item.id],
        );
        for (const p of parts) {
          await tx.query(
            `INSERT INTO parts (id, furniture_id, kind, label, material_id, cut_dimensions, spec) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
            [
              randomUUID(),
              newItemId,
              p.kind,
              p.label,
              p.material_id,
              p.cut_dimensions == null ? null : JSON.stringify(p.cut_dimensions),
              JSON.stringify(p.spec),
            ],
          );
        }
      }
      return (await this.loadProject(tx, newId))!;
    });
  }

  async deleteProject(id: string): Promise<boolean> {
    const rows = await this.db.query(`DELETE FROM projects WHERE id = $1 RETURNING id`, [id]);
    return rows.length > 0;
  }

  async listCustomers(q?: string): Promise<CustomerWithCount[]> {
    const params: unknown[] = [];
    let where = "";
    if (q?.trim()) {
      params.push(likePattern(q.trim()));
      where = `WHERE c.name ILIKE $1 OR c.phone ILIKE $1`;
    }
    const rows = await this.db.query<Row>(
      `SELECT c.*, (SELECT count(*)::int FROM projects p WHERE p.customer_id = c.id) AS project_count
       FROM customers c ${where} ORDER BY lower(c.name), c.id`,
      params,
    );
    return rows.map((r) => ({ ...toCustomer(r), projectCount: r.project_count as number }));
  }

  async getCustomer(id: string): Promise<Customer | null> {
    const rows = await this.db.query<Row>(`SELECT * FROM customers WHERE id = $1`, [id]);
    return rows[0] ? toCustomer(rows[0]) : null;
  }

  async createCustomer(input: CustomerInput): Promise<Customer> {
    const id = randomUUID();
    const rows = await this.db.query<Row>(
      `INSERT INTO customers (id, name, phone, address, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, input.name, input.phone, input.address, input.notes],
    );
    return toCustomer(rows[0]);
  }

  async updateCustomer(id: string, patch: CustomerPatch): Promise<Customer> {
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const col of ["name", "phone", "address", "notes"] as const) {
      if (patch[col] !== undefined) {
        params.push(patch[col]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    sets.push("updated_at = now()");
    const rows = await this.db.query<Row>(
      `UPDATE customers SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundError("הלקוח");
    return toCustomer(rows[0]);
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const rows = await this.db.query(`DELETE FROM customers WHERE id = $1 RETURNING id`, [id]);
    return rows.length > 0;
  }

  async getSettings(): Promise<ShopSettings> {
    const rows = await this.db.query<{ value: unknown }>(`SELECT value FROM settings WHERE key = 'shop'`);
    return settingsSchema.parse(rows[0]?.value ?? {});
  }

  async updateSettings(patch: Partial<ShopSettings>): Promise<ShopSettings> {
    const next = settingsSchema.parse({ ...(await this.getSettings()), ...patch });
    await this.db.query(
      `INSERT INTO settings (key, value) VALUES ('shop', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(next)],
    );
    return next;
  }
}
