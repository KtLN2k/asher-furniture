"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button, IconButton } from "./button";
import { cn } from "./cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** חלון קופץ מבוסס <dialog> מקורי: מלכודת פוקוס, Esc וכיסוי רקע מובנים. בטלפון נפתח כגיליון מלמטה. */
export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "m-auto w-[calc(100%-1.5rem)] max-w-md rounded-card bg-white p-0 text-ink-900 shadow-lift backdrop:bg-black/40",
        "max-sm:mb-3 max-sm:mt-auto",
        open && "animate-[sheet-up_0.18s_ease-out]",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-sand-200 px-5 py-3">
            <h2 id="dialog-title" className="text-xl font-bold">
              {title}
            </h2>
            <IconButton label="סגירה" onClick={onClose}>
              <X className="size-6" />
            </IconButton>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-start gap-3 border-t border-sand-200 px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  busy,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            ביטול
          </Button>
        </>
      }
    >
      <div className="text-lg text-ink-700">{children}</div>
    </Dialog>
  );
}
