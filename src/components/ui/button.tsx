import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "./cn";
import { Spinner } from "./misc";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
type Size = "md" | "lg" | "sm";

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-control font-semibold transition",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    size === "sm" && "min-h-11 px-4 text-base",
    size === "md" && "min-h-12 px-5 text-lg",
    size === "lg" && "min-h-14 px-6 text-xl",
    variant === "primary" && "bg-wood-600 text-white shadow-card hover:bg-wood-700",
    variant === "secondary" &&
      "border border-sand-300 bg-white text-ink-900 hover:border-wood-400 hover:bg-cream-100",
    variant === "ghost" && "text-wood-600 hover:bg-wood-50",
    variant === "danger" && "bg-danger-600 text-white hover:bg-danger-700",
    variant === "danger-ghost" && "text-danger-600 hover:bg-danger-50",
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant, size, loading, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner className="size-5" />}
      {children}
    </button>
  );
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function LinkButton({ variant, size, className, ...rest }: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...rest} />;
}

export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-700 transition hover:bg-sand-200 active:scale-95 disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
