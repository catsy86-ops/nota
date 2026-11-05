import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pluralPl } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { VIEW_GROUP, VIEW_LABEL } from "@/lib/viewMeta";
import { SIDEBAR_GROUP_LABELS } from "@/components/sidebar/sidebarItems";
import type { View } from "@/hooks/useFilteredNotes";
import { PageActionsSlot } from "@/components/PageActions";

// Ozdoba dnia w barwach stylu (plan motywów 2.5) — tylko na Dziś, leniwie.
const DaySignature = lazy(() => import("@/components/skins/DaySignature"));

/** Widoki, w których liczy się dzień (D-W5) — tylko one mają datę w linijce nad tytułem. Dziś nie: datę pokazuje
    ozdoba „1 lis” i karta dnia tuż pod główką, trzecia kopia łamała linijkę na telefonie. */
const DATED_VIEWS: ReadonlySet<View> = new Set<View>(["calendar", "shifts", "study"]);

/** Jedno zdanie pod tytułem (nowy plan 1.1): tylko tam, gdzie nazwa działu nie mówi, do czego służy. */
const VIEW_LEAD: Partial<Record<View, string>> = {
  debts: "Kto ile pożyczył i ile już oddał.",
};

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
 * Nowy plan 1.1: opis (`lead`) pod tytułem i akcje widoku po prawej (`PageActions`); na telefonie akcje
 * schodzą pod opis i tworzą jeden rząd.
 */
export function ViewTitle({ view, title, count, lead, crumbs, className }: {
  view: View; title?: ReactNode; count?: number; lead?: ReactNode;
  /** 5.8: rodzice bieżącego folderu albo etykiety, od korzenia. Telefon pokazuje tylko „‹ Rodzic”. */
  crumbs?: { label: string; onClick: () => void }[];
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const leadText = lead ?? VIEW_LEAD[view];
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
    // Linijka nad tytułem, jak nagłówek kartki w zeszycie. Pod nią siatka: tytuł z ozdobą dnia (Dziś) albo akcjami
    // po prawej, opis pod tytułem. Na telefonie akcje idą po opisie (kolejność w DOM), od `sm` wracają obok tytułu.
    <header ref={ref} data-page-head className={cn("w-full", className)}>
      {kicker.length > 0 && (
        <p className="mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">{kicker.join(" · ")}</p>
      )}
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Okruszki" data-crumbs className="mb-1 text-sm text-muted-foreground">
          <ol className="hidden flex-wrap items-center gap-1 sm:flex">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                <button type="button" onClick={c.onClick} className="rounded-control underline-offset-2 hover:text-foreground hover:underline outline-hidden focus-visible:ring-2 focus-visible:ring-ring">{c.label}</button>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </li>
            ))}
          </ol>
          <button type="button" onClick={crumbs[crumbs.length - 1].onClick} className="-ml-1 inline-flex min-h-11 items-center gap-0.5 rounded-control pr-2 hover:text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:hidden">
            <ChevronLeft className="h-4 w-4" aria-hidden />{crumbs[crumbs.length - 1].label}
          </button>
        </nav>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4">
        {/* `section-title`: podkreślenie piórem w kolorze działu (plan motywów 2.4, CSS w index.css). */}
        <h1 className="section-title col-start-1 row-start-1 justify-self-start font-display text-3xl font-bold tracking-tight text-foreground">{title ?? VIEW_LABEL[view]}</h1>
        {view === "today" && (
          <div className="col-start-2 row-start-1 self-end">
            <Suspense fallback={null}>
              <DaySignature />
            </Suspense>
          </div>
        )}
        {leadText && <p data-page-lead className="col-span-2 mt-2 max-w-prose text-sm text-muted-foreground sm:col-span-1">{leadText}</p>}
        <PageActionsSlot className="col-span-2 mt-3 flex flex-wrap items-center gap-2 empty:hidden sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:mt-0 sm:justify-end" />
      </div>
    </header>
  );
}
