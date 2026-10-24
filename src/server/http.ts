import { z } from "zod";
import { ConflictError, NotFoundError, ValidationError } from "./repo/types";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(code: string, message: string, status: number, extra?: object): Response {
  return json({ error: { code, message, ...extra } }, status);
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ValidationError("הבקשה אינה תקינה");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "הנתונים אינם תקינים");
  }
  return parsed.data;
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ValidationError) return errorResponse("validation", err.message, 400);
    if (err instanceof NotFoundError) return errorResponse("not_found", err.message, 404);
    if (err instanceof ConflictError) {
      return errorResponse("conflict", err.message, 409, { current: err.current });
    }
    console.error(err);
    return errorResponse("server", "אירעה תקלה בשרת. נסו שוב בעוד רגע.", 500);
  }
}
