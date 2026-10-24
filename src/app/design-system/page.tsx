import type { Metadata } from "next";
import { PROJECT_STATUSES } from "@/domain/catalog";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Card, Chip } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Wordmark } from "@/components/shell/logo";

export const metadata: Metadata = { title: "Design System", robots: { index: false } };

const swatches = [
  ["cream-50", "bg-cream-50"],
  ["cream-100", "bg-cream-100"],
  ["sand-200", "bg-sand-200"],
  ["sand-300", "bg-sand-300"],
  ["wood-100", "bg-wood-100"],
  ["wood-400", "bg-wood-400"],
  ["wood-600", "bg-wood-600"],
  ["wood-700", "bg-wood-700"],
  ["ink-900", "bg-ink-900"],
  ["ink-600", "bg-ink-600"],
  ["ink-300", "bg-ink-300"],
  ["ok-600", "bg-ok-600"],
  ["warn-600", "bg-warn-600"],
  ["danger-600", "bg-danger-600"],
  ["info-600", "bg-info-600"],
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-8">
      <header className="flex flex-col gap-3">
        <Wordmark />
        <h1 className="text-3xl font-extrabold">מערכת עיצוב</h1>
        <p className="text-ink-500">עמוד עזר למפתחים. הרכיבים בקוד: src/components/ui. הצבעים והמרווחים: src/app/globals.css.</p>
      </header>

      <section aria-labelledby="ds-colors" className="flex flex-col gap-3">
        <h2 id="ds-colors" className="text-2xl font-bold">צבעים</h2>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {swatches.map(([name, cls]) => (
            <li key={name} className="text-sm">
              <div className={`h-14 rounded-control border border-sand-200 ${cls}`} />
              <span className="mt-1 block text-ink-600">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ds-type" className="flex flex-col gap-2">
        <h2 id="ds-type" className="text-2xl font-bold">טיפוגרפיה (Heebo)</h2>
        <p className="text-4xl font-extrabold">כותרת ראשית ‏36</p>
        <p className="text-2xl font-bold">כותרת משנית ‏24</p>
        <p className="text-lg">טקסט גוף ‏17: נגרייה פרטית שמתכננת ומייצרת רהיטים בהתאמה אישית.</p>
        <p className="text-sm text-ink-500">טקסט משני ‏14: הערות, תוויות ותאריכים.</p>
      </section>

      <section aria-labelledby="ds-buttons" className="flex flex-col gap-3">
        <h2 id="ds-buttons" className="text-2xl font-bold">כפתורים (גובה מינימלי 48px, גדול 56px)</h2>
        <div className="flex flex-wrap gap-3">
          <Button>ראשי</Button>
          <Button variant="secondary">משני</Button>
          <Button variant="ghost">שקוף</Button>
          <Button variant="danger">מחיקה</Button>
          <Button variant="danger-ghost">מחיקה שקופה</Button>
          <Button loading>טוען</Button>
          <Button disabled>מושבת</Button>
          <Button size="lg">גדול</Button>
        </div>
      </section>

      <section aria-labelledby="ds-status" className="flex flex-col gap-3">
        <h2 id="ds-status" className="text-2xl font-bold">סטטוסים ומסננים</h2>
        <div className="flex flex-wrap gap-2">
          {PROJECT_STATUSES.map((s) => (
            <StatusBadge key={s.key} status={s.key} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active>פעיל</Chip>
          <Chip>רגיל</Chip>
        </div>
      </section>

      <section aria-labelledby="ds-forms" className="flex flex-col gap-3">
        <h2 id="ds-forms" className="text-2xl font-bold">טפסים וכרטיסים</h2>
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="שדה רגיל" hint="טקסט עזר קצר">{(p) => <TextInput {...p} placeholder="הקלידו כאן" />}</Field>
          <Field label="שדה עם שגיאה" error="יש להזין שם">{(p) => <TextInput {...p} />}</Field>
        </Card>
      </section>
    </main>
  );
}
