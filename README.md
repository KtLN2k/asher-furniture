# רהיטי אשר

מערכת Next.js לתכנון רהיטים בהתאמה אישית לנגרייה. הממשק כולו בעברית (RTL). זהו **שלב ב׳**: אשף תכנון מלא (7 שלבים) עם מודל תלת-ממד פרמטרי בזמן אמת, ספריית חומרים ומגבלות הניתנות לעריכה, וכל מה שנבנה בשלב א׳ (שמירה אוטומטית לשרת, "הפרויקטים שלי", לקוחות).

תיעוד הארכיטקטורה, מודל הנתונים והבחירות הטכנולוגיות: [ARCHITECTURE.md](./ARCHITECTURE.md).

## הרצה

דרישות: Node.js 22 ומעלה.

```bash
npm install
npm run dev          # http://localhost:3000
```

אין צורך להתקין בסיס נתונים: ברירת המחדל היא PostgreSQL מוטמע (PGlite) שנשמר בתיקייה `data/pglite`.

הפקה:

```bash
npm run build
npm start
```

### PostgreSQL אמיתי (Supabase / Docker)

```bash
docker run -d --name asher-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=asher -p 5432:5432 postgres:16
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/asher npm run dev
```

המיגרציות רצות אוטומטית בהתחברות הראשונה. (הפקודה עם Docker לא הורצה בסביבת הפיתוח; דרייבר `pg` נבדק אוטומטית מול שרת Postgres בפרוטוקול אמיתי.)

## בדיקות

```bash
npm run typecheck
npm run lint
npm test                 # Vitest: repository, דרייבר pg, API
npx playwright install chromium   # פעם אחת
npm run test:e2e         # בונה ומריץ Playwright (טלפון, מחשב, 5 גדלי מסך)
npm run test:all         # הכל ברצף
```

צילומי מסך מהבדיקות נשמרים ב-`test-results/screens/`. דוגמאות נבחרות נמצאות ב-`docs/screenshots/` (שלב א׳) וב-`docs/screenshots-b/` (שלב ב׳).

### תלת-ממד בבדיקות ובסביבה בלי כרטיס מסך

בדיקות ה-E2E והצילומים מריצים Chromium עם WebGL תוכנתי (SwiftShader): `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` (מוגדר ב-`playwright.config.ts`). הרינדור איטי אבל מדויק. בדפדפן רגיל עם כרטיס מסך אין צורך בכלום.

צילומי שלב ב׳ (שלבי האשף ותלת-ממד בטלפון, טאבלט ומחשב, כולל שחזור תמונת היעד):

```bash
npm run build && ASHER_DATA_DIR=/tmp/shots npx next start -p 3300 &
node scripts/capture-phase-b.mjs http://localhost:3300 docs/screenshots-b
```

### איכות תלת-ממד

ברירת המחדל אוטומטית לפי המכשיר ויורדת בזמן ריצה אם הקצב נמוך. אפשר לכפות רמה בכפתור "איכות" בתצוגה, או ב-`?quality=low|medium|high`.

## מבנה

```
src/domain      טיפוסים, סכמות, כללי תכנון, חומרים, חזיתות, פריסה ותקינות (קוד טהור)
src/three       מודל תלת-ממד פרמטרי, חומרים וטקסטורות, חדר, תאורה, איכות (React Three Fiber)
src/server      API helpers, repository, בסיס נתונים ומיגרציות
src/app         דפים ו-Route Handlers (api/)
src/components  ui (Design System), shell (ניווט), projects, customers, wizard, planner (שלבי התכנון), viewer (תלת-ממד), settings (ספריית חומרים ומגבלות)
src/lib         api client, שמירה אוטומטית, עזרים
tests           unit (Vitest) ו-e2e (Playwright)
```
