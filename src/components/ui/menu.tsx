"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { IconButton } from "./button";
import { cn } from "./cn";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

export function ActionMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <IconButton label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreVertical className="size-6" />
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full z-30 mt-1 min-w-52 overflow-hidden rounded-control border border-sand-200 bg-white py-1 shadow-lift"
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 px-4 text-start text-base font-medium hover:bg-cream-100",
                item.danger ? "text-danger-600" : "text-ink-900",
              )}
            >
              <span className="text-current opacity-80">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
