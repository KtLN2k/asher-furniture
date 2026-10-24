"use client";

import { useState } from "react";
import { getStoredServer, setStoredServer, usesLocalStore } from "@/lib/app-env";
import { checkServer, uploadLocalData, type UploadReport } from "@/lib/sync";
import { Button } from "../ui/button";
import { Field, TextInput } from "../ui/field";
import { Card } from "../ui/misc";
import { useToast } from "../ui/toast";

function normalize(url: string) {
  const t = url.trim().replace(/\/+$/, "");
  return !t || /^https?:\/\//i.test(t) ? t : `http://${t}`;
}

/** הגדרות האפליקציה הארוזה: איפה הנתונים נשמרים, וחיבור לשרת של הנגרייה. */
export function DeviceSettings() {
  const toast = useToast();
  const [stored] = useState(() => getStoredServer());
  const [url, setUrl] = useState(stored);
  const [busy, setBusy] = useState<"check" | "upload" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<UploadReport | null>(null);
  const local = usesLocalStore();
  const target = normalize(url);

  async function check() {
    setBusy("check");
    setError(null);
    setMsg(null);
    try {
      await checkServer(target);
      setMsg("השרת זמין ומוכן");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function save(next: string) {
    setStoredServer(next);
    toast(next ? "האפליקציה תעבוד מול השרת" : "האפליקציה תעבוד מקומית במכשיר");
    // טעינה מלאה בכוונה: החלפת מקור הנתונים של כל האפליקציה
    window.location.replace(new URL("/", window.location.href).href);
  }

  async function upload() {
    setBusy("upload");
    setError(null);
    setReport(null);
    try {
      const r = await uploadLocalData(target, setMsg);
      setReport(r);
      setMsg(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <Card className="p-5" data-testid="device-storage">
        <h2 className="text-xl font-bold">איפה הנתונים נשמרים</h2>
        <p className="mt-2 text-ink-700">
          {local ? (
            <>
              <strong>במכשיר הזה בלבד.</strong> הפרויקטים, הלקוחות וספריית החומרים נשמרים בזיכרון האפליקציה ואפשר לעבוד בלי
              אינטרנט. מחיקת האפליקציה מוחקת גם אותם.
            </>
          ) : (
            <>
              <strong>בשרת:</strong> <span dir="ltr">{stored}</span>. כל המכשירים שמחוברים לאותו שרת רואים את אותם
              פרויקטים.
            </>
          )}
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-xl font-bold">חיבור לשרת הנגרייה</h2>
        <p className="mt-1 mb-4 text-ink-500">
          כתובת השרת שמריץ את המערכת (למשל <span dir="ltr">http://192.168.1.20:3000</span>). השאירו ריק לעבודה מקומית.
        </p>
        <Field label="כתובת השרת" error={error} hint={msg ?? undefined} optional>
          {(p) => (
            <TextInput
              {...p}
              data-testid="server-url"
              dir="ltr"
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="http://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={check} loading={busy === "check"} disabled={!target || busy !== null}>
            בדיקת חיבור
          </Button>
          <Button onClick={() => save(target)} disabled={busy !== null || target === stored} data-testid="server-save">
            {target ? "שמירה ומעבר לעבודה מול השרת" : "שמירה ומעבר לעבודה מקומית"}
          </Button>
        </div>
      </Card>

      {local && (
        <Card className="p-5">
          <h2 className="text-xl font-bold">העלאת הנתונים מהמכשיר לשרת</h2>
          <p className="mt-1 mb-4 text-ink-500">
            מעתיק את הלקוחות והפרויקטים שנשמרו במכשיר לשרת שבכתובת למעלה. פרויקט שכבר הועלה לא יועלה פעמיים. מומלץ לבדוק
            חיבור קודם.
          </p>
          <Button variant="secondary" onClick={upload} loading={busy === "upload"} disabled={!target || busy !== null}>
            העלאה לשרת
          </Button>
          {report && (
            <div className="mt-4 rounded-control bg-cream-100 px-4 py-3 text-ink-700" data-testid="upload-report">
              <p>
                הועלו {report.customers} לקוחות ו-{report.projects} פרויקטים
                {report.skipped > 0 && <>, {report.skipped} פרויקטים כבר היו בשרת</>}.
              </p>
              {report.errors.length > 0 && (
                <ul className="mt-2 list-disc ps-5 text-danger-600">
                  {report.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
