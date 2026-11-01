import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { pluralPl } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { VIEW_GROUP, VIEW_LABEL } from "@/lib/viewMeta";
import { SIDEBAR_GROUP_LABELS } from "@/components/sidebar/sidebarItems";
import type { View } from "@/hooks/useFilteredNotes";

// Ozdoba dnia w barwach stylu (plan motywów 2.5) — tylko na Dziś, leniwie.
const DaySignature = lazy(() => import("@/components/skins/DaySignature"));

/** Widoki, w których liczy się dzień (D-W5) — tylko one mają datę w linijce nad tytułem. Dziś nie: datę pokazuje
    ozdoba „1 lis” i karta dnia tuż pod główką, trzecia kopia łamała linijkę na telefonie. */
const DATED_VIEWS: ReadonlySet<View> = new Set<View>(["calendar", "shifts", "study"]);

/** Linijka nad tytułem: grupa działu, folder albo etykieta. */
function kickerGroup(view: View): string {
  if (view === "folder") return "Folder";
  if (view === "label") return "Etykieta";
  const group = VIEW_GROUP[view];
  const label = group ? SIDEBAR_GROUP_LABELS[group] : "";
  // „PRACA” nad tytułem „Praca” nic nie mówi — grupa o nazwie działu jest pomijana.
  return label === VIEW_LABEL[view] ? "" : label;
}

/**
 * Główka kartki (plan wyglądu 2026-11-01, Faza 1): jeden nagłówek strony w każdym dziale — linijka mono
 * (grupa · data · liczba notatek) i tytuł z jednym pociągnięciem pióra. Jedyny h1 widoku; pasek u góry pokazuje
 * mały tytuł dopiero, gdy główka zniknie z ekranu (`data-head-out` na <html>, CSS w `AppHeader`).
 */
export function ViewTitle({ view, title, count, className }: { view: View; title?: ReactNode; count?: number; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el || typeof IntersectionObserver === "undefined") return;
    // Margines = wysokość paska u góry: tytuł „wychodzi”, gdy chowa się pod paskiem, nie dopiero za krawędzią okna.
    const io = new IntersectionObserver(([e]) => root.toggleAttribute("data-head-out", !e.isIntersecting), { rootMargin: "-72px 0px 0px 0px" });
    io.observe(el);
    return () => { io.disconnect(); root.removeAttribute("data-head-out"); };
  }, [view]);

  const date = DATED_VIEWS.has(view) ? new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" }) : null;
  const kicker = [kickerGroup(view), date, count !== undefined ? `${count} ${pluralPl(count, ["notatka", "notatki", "notatek"])}` : null].filter(Boolean);

  return (
    // Siatka: ozdoba dnia stoi obok główki (Dziś); linijka nad tytułem, jak nagłówek kartki w zeszycie.
    <header ref={ref} data-page-head className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4", className)}>
      {kicker.length > 0 && (
        <p className="col-span-2 mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">{kicker.join(" · ")}</p>
      )}
      {/* `section-title`: podkreślenie piórem w kolorze działu (plan motywów 2.4, CSS w index.css). */}
      <h1 className="section-title col-start-1 justify-self-start font-display text-3xl font-bold tracking-tight text-foreground">{title ?? VIEW_LABEL[view]}</h1>
      {view === "today" && (
        <div className="col-start-2 self-end">
          <Suspense fallback={null}>
            <DaySignature />
          </Suspense>
        </div>
      )}
    </header>
  );
}
