import { toast } from "sonner";

export interface UndoToastOptions {
  description?: string;
  /** icon rendered before the message (emoji or single char) */
  icon?: string;
  /** milliseconds before the toast disappears; defaults to 5000 */
  duration?: number;
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
  const id = toast(message, {
    description: opts.description,
    icon: opts.icon,
    duration: opts.duration ?? 5000,
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
