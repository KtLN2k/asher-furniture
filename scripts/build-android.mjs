/**
 * בניית הלקוח הסטטי לאפליקציית אנדרואיד (Capacitor) ואריזת APK.
 *
 *   node scripts/build-android.mjs            ייצוא סטטי + cap sync + APK debug
 *   node scripts/build-android.mjs --web-only ייצוא סטטי + cap sync בלבד
 *   node scripts/build-android.mjs --release  גם APK release (חתום ב-keystore מ-android/keystore.properties)
 *
 * ייצוא סטטי של Next לא מאפשר Route Handlers (ה-API), לכן תיקיית src/app/api מועברת
 * הצידה למשך הבנייה ומוחזרת תמיד בסיומה.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const apiDir = path.join(root, "src/app/api");
const parkedApi = path.join(root, ".android-build/api");
const pgliteDist = path.join(root, "node_modules/@electric-sql/pglite/dist");
const publicPglite = path.join(root, "public/pglite");

function run(cmd, cmdArgs, extraEnv = {}) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: "inherit", env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) throw new Error(`${cmd} נכשל (קוד ${r.status})`);
}

if (existsSync(parkedApi)) {
  // בנייה קודמת נקטעה: מחזירים את ה-API לפני שממשיכים
  if (!existsSync(apiDir)) renameSync(parkedApi, apiDir);
  else rmSync(parkedApi, { recursive: true, force: true });
}

mkdirSync(publicPglite, { recursive: true });
for (const f of ["pglite.wasm", "pglite.data"]) cpSync(path.join(pgliteDist, f), path.join(publicPglite, f));

mkdirSync(path.dirname(parkedApi), { recursive: true });
renameSync(apiDir, parkedApi);
try {
  rmSync(path.join(root, "out"), { recursive: true, force: true });
  run("npx", ["next", "build"], {
    NEXT_PUBLIC_STATIC_APP: "1",
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? "",
  });
} finally {
  renameSync(parkedApi, apiDir);
}

run("npx", ["cap", "sync", "android"]);

if (!args.has("--web-only")) {
  const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  const tasks = ["assembleDebug", ...(args.has("--release") ? ["assembleRelease"] : [])];
  const r = spawnSync(gradle, tasks, { cwd: path.join(root, "android"), stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error("בניית ה-APK נכשלה");
  console.log("\nAPK debug:   android/app/build/outputs/apk/debug/app-debug.apk");
  if (args.has("--release")) console.log("APK release: android/app/build/outputs/apk/release/app-release.apk");
}
