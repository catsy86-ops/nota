import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

interface TocItem { level: number; text: string; el: HTMLElement }

/** Od ilu nagłówków spis treści ma sens — przy dwóch krótka notatka widać w całości. */
const MIN_HEADINGS = 3;

/**
 * Spis treści czytnika zbudowany z nagłówków faktycznie wyrenderowanych w treści
 * (więc zgodny z każdą składnią Markdown, także z nagłówkami podkreślanymi).
 * Treść wchodzi leniwie, dlatego obserwujemy zmiany drzewa DOM.
 */
export function ReaderToc({ rootRef, resetKey, className }: { rootRef: RefObject<HTMLElement | null>; resetKey: string; className?: string }) {
  const [items, setItems] = useState<TocItem[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const read = () => {
      const next = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3"))
        .map((el) => ({ level: Number(el.tagName[1]), text: (el.textContent ?? "").trim(), el }))
        .filter((h) => h.text);
      setItems((prev) =>
        prev.length === next.length && prev.every((p, i) => p.el === next[i].el && p.text === next[i].text) ? prev : next,
      );
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [rootRef, resetKey]);

  if (items.length < MIN_HEADINGS) return null;
  const base = Math.min(...items.map((i) => i.level));

  return (
    <nav aria-label="Spis treści" className={cn("mb-4 rounded-card border border-border/60 bg-muted/30 px-3 py-2", className)}>
      <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Spis treści</p>
      <ol className="space-y-0.5">
        {items.map((h, i) => (
          <li key={i} style={{ paddingLeft: `${(h.level - base) * 0.75}rem` }}>
            <button
              type="button"
              onClick={() => h.el.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-left text-sm text-foreground/80 hover:text-primary-ink hover:underline underline-offset-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
            >
              {h.text}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
