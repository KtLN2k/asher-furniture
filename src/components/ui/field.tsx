import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export const inputClasses =
  "w-full min-h-12 rounded-control border border-sand-300 bg-white px-4 text-lg text-ink-900 placeholder:text-ink-300 transition focus:border-wood-500 focus:outline-none focus:ring-4 focus:ring-wood-100 disabled:bg-cream-100 disabled:text-ink-500";

export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const descId = hint || error ? `${id}-d` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-semibold text-ink-700">
        {label}
        {optional && <span className="ms-2 font-normal text-ink-500">(לא חובה)</span>}
      </label>
      {children({ id, "aria-describedby": descId, "aria-invalid": error ? true : undefined })}
      {(error || hint) && (
        <p id={descId} className={cn("text-sm", error ? "font-medium text-danger-600" : "text-ink-500")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClasses, className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClasses, "min-h-28 py-3", className)} {...rest} />;
}
