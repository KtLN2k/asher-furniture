import type { Limits } from "@/domain/limits";
import type { LibraryItem, MaterialCreateInput, MaterialPatchInput } from "@/domain/materials";
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

export class NotFoundError extends Error {
  constructor(what = "הפריט") {
    super(`${what} לא נמצא`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(public current: Project) {
    super("הפרויקט עודכן בינתיים ממקום אחר");
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * שכבת הגישה לנתונים. כל המערכת (API, בדיקות) מדברת רק מול הממשק הזה,
 * כך שאפשר להחליף את המימוש (למשל Supabase SDK) בלי לגעת בשאר הקוד.
 */
export interface Repository {
  listProjects(query?: ProjectListQuery): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: ProjectCreateInput): Promise<Project>;
  /** baseRevision: אם נשלח והוא שונה מהנוכחי -> ConflictError. */
  updateProject(id: string, patch: ProjectPatch, baseRevision?: number): Promise<Project>;
  duplicateProject(id: string): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;

  listCustomers(q?: string): Promise<CustomerWithCount[]>;
  getCustomer(id: string): Promise<Customer | null>;
  createCustomer(input: CustomerInput): Promise<Customer>;
  updateCustomer(id: string, patch: CustomerPatch): Promise<Customer>;
  /** מחיקת לקוח לא מוחקת פרויקטים; הם נשארים ללא לקוח. */
  deleteCustomer(id: string): Promise<boolean>;

  getSettings(): Promise<ShopSettings>;
  updateSettings(patch: Partial<ShopSettings>): Promise<ShopSettings>;

  listMaterials(): Promise<LibraryItem[]>;
  createMaterial(input: MaterialCreateInput): Promise<LibraryItem>;
  updateMaterial(id: string, patch: MaterialPatchInput): Promise<LibraryItem>;
  /** מחיקה נחסמת כשהפריט בשימוש בפרויקט (ValidationError); אפשר להשבית במקום. */
  deleteMaterial(id: string): Promise<boolean>;

  getLimits(): Promise<Limits>;
  updateLimits(limits: Limits): Promise<Limits>;
}
