import { z } from "zod";
import { STATUS_KEYS, type CategoryKey, type ProjectStatus } from "./catalog";
import { designPatchSchema, type FurnitureDesign } from "./design";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerWithCount extends Customer {
  projectCount: number;
}

export interface CustomerRef {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  category: CategoryKey | null;
  customer: CustomerRef | null;
  thumbnail: string | null;
  wizardStep: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface Project extends ProjectSummary {
  notes: string;
  furnitureId: string;
  design: FurnitureDesign;
}

const trimmed = (max: number) => z.string().trim().max(max);

export const customerInputSchema = z.object({
  name: trimmed(120).min(1, "יש להזין שם לקוח"),
  phone: trimmed(40).default(""),
  address: trimmed(200).default(""),
  notes: trimmed(2000).default(""),
});
export type CustomerInput = z.infer<typeof customerInputSchema>;

export const customerPatchSchema = customerInputSchema.partial();
export type CustomerPatch = z.infer<typeof customerPatchSchema>;

export const projectCreateSchema = z.object({
  name: trimmed(120).min(1, "יש להזין שם לפרויקט"),
  customerId: z.string().min(1).nullable().optional(),
  status: z.enum(STATUS_KEYS).optional(),
  notes: trimmed(4000).optional(),
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectPatchSchema = z.object({
  name: trimmed(120).min(1, "יש להזין שם לפרויקט").optional(),
  customerId: z.string().min(1).nullable().optional(),
  status: z.enum(STATUS_KEYS).optional(),
  notes: trimmed(4000).optional(),
  wizardStep: z.number().int().min(1).max(20).optional(),
  archived: z.boolean().optional(),
  design: designPatchSchema.optional(),
});
export type ProjectPatch = z.infer<typeof projectPatchSchema>;

export const settingsSchema = z.object({
  businessName: trimmed(120).default("רהיטי אשר"),
  businessPhone: trimmed(40).default(""),
  businessAddress: trimmed(200).default(""),
});
export type ShopSettings = z.infer<typeof settingsSchema>;

export type ArchiveFilter = "exclude" | "only" | "all";

export interface ProjectListQuery {
  q?: string;
  status?: ProjectStatus;
  archived?: ArchiveFilter;
  customerId?: string;
  limit?: number;
}
