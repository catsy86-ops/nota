import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { requestContextMenu, shouldOpenContextMenu, subscribeContextMenu } from "@/lib/contextMenu";

/** Q5.3: `onContextMenu` dla wiersza — otwiera menu „⋯” o tym `id` zamiast menu przeglądarki (z wyjątkami z `shouldOpenContextMenu`). */
export function contextMenuTrigger(id: string) {
  return (e: MouseEvent) => {
    if (!shouldOpenContextMenu(e, window.getSelection()?.toString() ?? "")) return;
    e.preventDefault();
    requestContextMenu(id);
  };
}

/** Q5.3: stan otwarcia menu „⋯” sterowany także prawym przyciskiem wiersza (`contextMenuTrigger(id)`). */
export function useContextMenuTarget(id: string): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => subscribeContextMenu((target) => { if (target === id) setOpen(true); }), [id]);
  return [open, useCallback((o: boolean) => setOpen(o), [])];
}
