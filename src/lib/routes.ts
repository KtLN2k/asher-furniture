"use client";

import { useParams, useSearchParams } from "next/navigation";
import { IS_STATIC_APP, ROUTE_PLACEHOLDER } from "./app-env";

/**
 * בניית קישורים לדפים עם מזהה.
 * באתר: `/projects/<id>/wizard?step=3`.
 * באפליקציה הסטטית אין נתיבים דינמיים, ולכן הדף נבנה פעם אחת עם מציין המקום `_`
 * והמזהה עובר בשאילתה: `/projects/_/wizard/?id=<id>&step=3`.
 */
function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const q = sp.toString();
  return q ? `${path}?${q}` : path;
}

export const routes = {
  project: (id: string) => (IS_STATIC_APP ? routes.wizard(id) : `/projects/${id}`),
  wizard: (id: string, step?: number) =>
    IS_STATIC_APP
      ? withQuery(`/projects/${ROUTE_PLACEHOLDER}/wizard/`, { id, step })
      : withQuery(`/projects/${id}/wizard`, { step }),
  customer: (id: string) => (IS_STATIC_APP ? withQuery(`/customers/${ROUTE_PLACEHOLDER}/`, { id }) : `/customers/${id}`),
};

/** המזהה של הדף הנוכחי: מהנתיב, או מהשאילתה כשהנתיב הוא מציין המקום. */
export function useRouteId(): string {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  if (id === ROUTE_PLACEHOLDER) return sp.get("id") ?? "";
  return id;
}