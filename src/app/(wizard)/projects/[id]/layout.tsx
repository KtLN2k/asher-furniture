import { staticIdParams } from "@/lib/app-env";

/** בייצוא סטטי (APK) הנתיב נבנה פעם אחת עם מציין מקום; המזהה עובר בשאילתה. */
export const generateStaticParams = staticIdParams;

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
