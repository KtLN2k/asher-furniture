import type { HTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden className={cn("animate-[spin_0.9s_linear_infinite]", className)} />;
}

export function LoadingBlock({ label = "טוען…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-ink-500">
      <Spinner className="size-6" />
      <span>{label}</span>
    </div>
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-sand-200 bg-white shadow-card", className)} {...rest} />;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-sand-300 bg-cream-100/60 px-6 py-12 text-center">
      {icon && <div className="text-wood-400">{icon}</div>}
      <h2 className="text-xl font-bold">{title}</h2>
      {text && <p className="max-w-md text-ink-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger-600/30 bg-danger-50 px-4 py-3 text-danger-700">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-11 rounded-control px-4 font-semibold underline">
          נסו שוב
        </button>
      )}
    </div>
  );
}

export function Chip({
  active,
  children,
  ...rest
}: { active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "min-h-11 shrink-0 rounded-full border px-4 text-base font-medium transition",
        active
          ? "border-wood-600 bg-wood-600 text-white"
          : "border-sand-300 bg-white text-ink-700 hover:border-wood-400",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
