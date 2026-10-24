import { cn } from "../ui/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/logo.svg" alt="" width={44} height={44} className={cn("size-11 rounded-xl", className)} />
  );
}

export function Wordmark({ className, tagline = true }: { className?: string; tagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      <div className="leading-tight">
        <div className="text-2xl font-extrabold tracking-tight text-ink-900">רהיטי אשר</div>
        {tagline && <div className="text-sm text-ink-500">עיצוב · איכות · התאמה אישית</div>}
      </div>
    </div>
  );
}
