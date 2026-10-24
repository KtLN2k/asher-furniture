# רהיטי אשר

מערכת Next.js לתכנון רהיטים בהתאמה אישית לנגרייה. הממשק כולו בעברית (RTL). זהו **שלב א׳**: בסיס, מסך בית, אשף פרויקט חדש (שלבים 1-2 עובדים, השאר שלד), שמירה אוטומטית לשרת, "הפרויקטים שלי" ולקוחות.

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

צילומי מסך מהבדיקות נשמרים ב-`test-results/screens/`. דוגמאות נבחרות נמצאות ב-`docs/screenshots/`.

## מבנה

```
src/domain      טיפוסים, סכמות וקטלוגים (קוד טהור)
src/server      API helpers, repository, בסיס נתונים ומיגרציות
src/app         דפים ו-Route Handlers (api/)
src/components  ui (Design System), shell (ניווט), projects, customers, wizard
src/lib         api client, שמירה אוטומטית, עזרים
tests           unit (Vitest) ו-e2e (Playwright)
```
