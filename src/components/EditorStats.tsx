import { memo, useDeferredValue, useEffect, useMemo, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { statsLabel } from "@/lib/textStats";

const SELECTION_EVENTS = ["selectionchange", "select", "keyup", "mouseup", "touchend", "input"] as const;

/**
 * Licznik pod polem treści: słowa, znaki, czas czytania — a przy zaznaczeniu
 * liczby dla zaznaczenia. Osobny podkomponent: zaznaczanie myszą przerysowuje
 * tylko ten wiersz, nie całą kartę. Treść jest „odroczona”, więc pisanie nie
 * czeka na liczenie przy długich notatkach.
 */
export const EditorStats = memo(function EditorStats({
  textareaRef,
  value,
  className,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  className?: string;
}) {
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const deferred = useDeferredValue(value);

  useEffect(() => {
    function read(e: Event) {
      const ta = textareaRef.current;
      if (!ta || (e.target !== ta && e.type !== "selectionchange")) return;
      if (document.activeElement !== ta) return;
      const a = ta.selectionStart;
      const b = ta.selectionEnd;
      setSel((prev) => (prev[0] === a && prev[1] === b ? prev : [a, b]));
    }
    for (const t of SELECTION_EVENTS) document.addEventListener(t, read, true);
    return () => { for (const t of SELECTION_EVENTS) document.removeEventListener(t, read, true); };
  }, [textareaRef]);

  const label = useMemo(() => statsLabel(deferred, sel[0], sel[1]), [deferred, sel]);

  return <span data-testid="editor-stats" className={cn("truncate", className)}>{label}</span>;
});
