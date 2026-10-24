"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderOpen, Plus, Users, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../ui/cn";
import { LogoMark, Wordmark } from "./logo";

const NAV = [
  { href: "/", label: "בית", icon: Home, match: (p: string) => p === "/" },
  { href: "/projects", label: "הפרויקטים שלי", short: "פרויקטים", icon: FolderOpen, match: (p: string) => p === "/projects" },
  { href: "/customers", label: "לקוחות", icon: Users, match: (p: string) => p.startsWith("/customers") },
  { href: "/settings", label: "הגדרות", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

/**
 * שלושה פריסות אמיתיות:
 *  - טלפון (<768): כותרת עליונה + ניווט תחתון עם כפתור "חדש" בולט. במצב אשף הניווט התחתון מוסתר ומוחלף בסרגל פעולות.
 *  - טאבלט (768-1023): פס צד צר עם אייקונים ותוויות.
 *  - מחשב (1024+): סרגל צד רחב עם לוגו ותוויות.
 */
export function AppShell({ children, focusOnMobile = false }: { children: ReactNode; focusOnMobile?: boolean }) {
  const pathname = usePathname();
  const newActive = pathname === "/projects/new";

  return (
    <div className="min-h-dvh md:flex">
      <aside
        className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col gap-2 border-e border-sand-200 bg-cream-100 py-5 md:flex md:w-24 lg:w-64 lg:px-4"
      >
        <Link href="/" className="mb-3 flex justify-center lg:justify-start lg:px-2" aria-label="רהיטי אשר - דף הבית">
          <span className="lg:hidden">
            <LogoMark />
          </span>
          <span className="hidden lg:block">
            <Wordmark tagline={false} />
          </span>
        </Link>
        <Link
          href="/projects/new"
          className={cn(
            "mx-auto mb-3 flex w-[4.5rem] flex-col items-center gap-1 rounded-2xl bg-wood-600 py-3 text-white shadow-card transition hover:bg-wood-700 lg:mx-0 lg:w-full lg:flex-row lg:justify-center lg:gap-2 lg:py-3.5",
            newActive && "ring-4 ring-wood-100",
          )}
        >
          <Plus className="size-7" />
          <span className="text-sm font-semibold leading-tight lg:text-lg">
            <span className="lg:hidden">חדש</span>
            <span className="hidden lg:inline">פרויקט חדש</span>
          </span>
        </Link>
        <nav aria-label="ניווט ראשי" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, match, ...rest }) => {
            const active = match(pathname);
            const short = "short" in rest ? rest.short : label;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mx-2 flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-sm font-medium transition lg:mx-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-lg",
                  active ? "bg-wood-100 text-wood-700" : "text-ink-600 hover:bg-sand-200",
                )}
              >
                <Icon className="size-6" />
                <span className="lg:hidden">{short}</span>
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-20 flex items-center border-b border-sand-200 bg-cream-50/95 px-4 py-2 backdrop-blur md:hidden",
            focusOnMobile && "hidden",
          )}
        >
          <Link href="/" aria-label="רהיטי אשר - דף הבית" className="flex min-h-11 items-center">
            <Wordmark tagline={false} className="[&_img]:size-9" />
          </Link>
        </header>

        <main className={cn("flex-1", focusOnMobile ? "" : "pb-28 md:pb-10")}>{children}</main>

        <nav
          aria-label="ניווט תחתון"
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 border-t border-sand-200 bg-white/95 pb-[var(--safe-bottom)] backdrop-blur md:hidden",
            focusOnMobile && "hidden",
          )}
        >
          <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
            {[NAV[0], NAV[1], null, NAV[2], NAV[3]].map((item, i) =>
              item ? (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.match(pathname) ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                      item.match(pathname) ? "text-wood-600" : "text-ink-500",
                    )}
                  >
                    <item.icon className="size-6" />
                    {"short" in item ? item.short : item.label}
                  </Link>
                </li>
              ) : (
                <li key={`new-${i}`} className="flex justify-center">
                  <Link
                    href="/projects/new"
                    aria-label="פרויקט חדש"
                    className="-mt-6 flex size-16 flex-col items-center justify-center rounded-full border-4 border-white bg-wood-600 text-white shadow-lift active:scale-95"
                  >
                    <Plus className="size-8" />
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
}
