import type { ReactNode } from "react";
import { cn } from "../ui/cn";

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 md:py-8", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
