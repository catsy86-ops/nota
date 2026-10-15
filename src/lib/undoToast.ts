import type { CSSProperties } from "react";
import { toast } from "sonner";
import { undoToastDuration } from "@/lib/siteMode";

export interface UndoToastOptions {
  description?: string;
  /** icon rendered before the message (emoji or single char) */
  icon?: string;
  /** milliseconds before the toast disappears; defaults to 5000 (tryb budowa: co najmniej 8000) */
  duration?: number;
  /** Stałe id: kolejny dymek z tym samym id zastępuje poprzedni zamiast się układać w stos. */
  id?: string;
}

/**
 * Show a toast with an "Undo" (Cofnij) action button.
 * Fires the `undo` callback exactly once — clicking Cofnij closes the toast
 * and rolls back the destructive action.
 */
export function toastWithUndo(
  message: string,
  undo: () => void,
  opts: UndoToastOptions = {}
) {
  let called = false;
  const duration = undoToastDuration(opts.duration ?? 5000);
  const id = toast(message, {
    ...(opts.id ? { id: opts.id } : {}),
    description: opts.description,
    icon: opts.icon,
    duration,
    // Cienki pasek upływu czasu na dole dymka (patrz `.toast-undo` w index.css).
    className: "toast-undo",
    style: { "--toast-ms": `${duration}ms` } as CSSProperties,
    action: {
      label: "Cofnij",
      onClick: () => {
        if (called) return;
        called = true;
        try { undo(); } catch { /* ignore */ }
        toast.dismiss(id);
        toast.success("Cofnięto");
      },
    },
  });
  return id;
}
