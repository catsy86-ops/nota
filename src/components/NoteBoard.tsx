import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BOARD_COLUMN_WIDTH, BoardColumnHeading } from "@/components/BoardColumn";

export interface BoardHeader {
  key: string;
  label: ReactNode;
  count: number;
}

/**
 * Tablica: kolumny przewijane w poziomie z przyciąganiem. Kontener `overflow-x-auto` przejmuje
 * też oś Y, więc nagłówki w kolumnach nie mogą być `sticky` względem strony — zamiast tego nad
 * kolumnami jest przyklejony pasek z ich kopią, przesuwany razem z poziomym przewinięciem.
 * Pojawia się dopiero, gdy nagłówki w kolumnach zjadą pod nagłówek aplikacji.
 */
export function NoteBoard({ headers, children }: { headers: BoardHeader[]; children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current, strip = stripRef.current, row = rowRef.current, scroller = scrollerRef.current;
    if (!wrap || !strip || !row || !scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const w = wrap.getBoundingClientRect();
      // Pasek ma wysokość 0 i jest `sticky`: dopóki nie przywarł, leży na górnej krawędzi tablicy.
      const offset = strip.getBoundingClientRect().top - w.top;
      setStuck(offset > 10 && w.bottom - strip.getBoundingClientRect().top > 64);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const syncX = () => { row.style.transform = `translateX(${-scroller.scrollLeft}px)`; };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    scroller.addEventListener("scroll", syncX, { passive: true });
    update();
    syncX();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      scroller.removeEventListener("scroll", syncX);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div
        ref={stripRef}
        aria-hidden
        data-board-sticky
        data-stuck={stuck || undefined}
        className="sticky top-(--app-header-h,0px) [html.header-hidden_&]:top-0 z-dropdown h-0 transition-[top] duration-300 ease-out motion-reduce:transition-none pointer-events-none"
      >
        <div
          className={cn(
            "absolute inset-x-0 top-0 -mx-1 overflow-hidden pt-1.5 transition-opacity duration-fast",
            stuck ? "opacity-100" : "opacity-0",
          )}
        >
          <div ref={rowRef} className="flex w-max gap-3 sm:gap-4 px-1">
            {headers.map((h) => (
              <BoardColumnHeading
                key={h.key}
                label={h.label}
                count={h.count}
                className={cn(BOARD_COLUMN_WIDTH, "shrink-0 rounded-xl border border-border/60 bg-card/95 backdrop-blur-md shadow-sm px-3.5 py-2")}
              />
            ))}
          </div>
        </div>
      </div>
      <div ref={scrollerRef} data-board className="flex items-start gap-3 sm:gap-4 overflow-x-auto snap-x pb-3 -mx-1 px-1">
        {children}
      </div>
    </div>
  );
}
