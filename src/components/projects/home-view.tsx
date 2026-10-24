"use client";

import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { FURNITURE_CATEGORIES } from "@/domain/catalog";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { CategoryArt } from "../illustrations/category-art";
import { PageContainer } from "../shell/page";
import { LinkButton } from "../ui/button";
import { ErrorNotice, LoadingBlock } from "../ui/misc";
import { ProjectCard } from "./project-card";

export function HomeView() {
  const recent = useAsync((signal) => api.listProjects({ limit: 4 }, signal), []);
  const latest = recent.data?.[0];

  return (
    <PageContainer className="flex flex-col gap-8">
      <section className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">מה נתכנן היום?</h1>
          <p className="mt-1 text-ink-500">עיצוב · איכות · התאמה אישית</p>
        </div>
        <LinkButton href="/projects/new" size="lg" className="w-full text-2xl md:w-auto md:min-w-72">
          <Plus className="size-7" aria-hidden />
          פרויקט חדש
        </LinkButton>
      </section>

      {latest && (
        <section aria-labelledby="continue-title">
          <h2 id="continue-title" className="sr-only">
            המשך עבודה
          </h2>
          <LinkButton
            href={`/projects/${latest.id}`}
            variant="secondary"
            size="lg"
            className="w-full justify-between border-wood-400 bg-wood-50 text-wood-700"
          >
            <span className="truncate">המשך מהמקום שעצרתם: {latest.name}</span>
            <ArrowLeft className="size-6 shrink-0" aria-hidden />
          </LinkButton>
        </section>
      )}

      <section aria-labelledby="cat-title">
        <h2 id="cat-title" className="mb-3 text-2xl font-bold">
          קטגוריות רהיטים
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {FURNITURE_CATEGORIES.map((c) => (
            <li key={c.key}>
              <Link
                href={`/projects/new?type=${c.key}`}
                className="group block overflow-hidden rounded-card border border-sand-200 bg-white shadow-card transition hover:border-wood-400 hover:shadow-lift"
              >
                <CategoryArt category={c.key} className="aspect-[4/3] w-full" />
                <span className="block px-3 py-3 text-center text-lg font-bold">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recent-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-title" className="text-2xl font-bold">
            פרויקטים אחרונים
          </h2>
          <Link href="/projects" className="inline-flex min-h-11 items-center gap-1 font-semibold text-wood-600">
            הצג הכל <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </div>
        {recent.loading && !recent.data && <LoadingBlock />}
        {recent.error && <ErrorNotice message={recent.error} onRetry={recent.reload} />}
        {recent.data && recent.data.length === 0 && (
          <div className="rounded-card border border-dashed border-sand-300 bg-cream-100/60 px-6 py-8 text-center text-ink-500">
            עדיין אין פרויקטים. לחצו על ״פרויקט חדש״ כדי להתחיל.
          </div>
        )}
        {recent.data && recent.data.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recent.data.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
