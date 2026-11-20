import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cardVariant } from "@/components/ui/card";
import type { LazyView } from "@/lib/viewPreload";

// Zarys widoku ładowanego leniwie (Kalendarz, Grafik, Nauka) — zamiast pustego
// ekranu przy pierwszym wejściu na wolnym łączu. Pojawia się z opóźnieniem
// (`.view-skeleton` w index.css), więc szybkie ładowanie nie mignie szkieletem.
// W5.5: kości stoją w prawdziwej karcie (`cardVariant()`, `p-card`) i układają się jak docelowy widok,
// więc przejście szkielet → treść nie przesuwa ramek, tylko wypełnia je tekstem.

/** Widoki leniwe z preloadem plus te, które ładują się tylko po wejściu (plan UI 2026-11-06, 3.5). */
export type SkeletonView = LazyView | "cwiczenia" | "debts" | "week";

const LABELS: Record<SkeletonView, string> = {
  calendar: "Ładowanie kalendarza…",
  shifts: "Ładowanie grafiku…",
  study: "Ładowanie Pracy…",
  plans: "Ładowanie planów…",
  cwiczenia: "Ładowanie ćwiczeń…",
  debts: "Ładowanie długów…",
  week: "Ładowanie osi tygodnia…",
};

function Bone({ className }: { className?: string }) {
  return <div className={cn("view-skeleton-bone rounded-control bg-muted", className)} />;
}

/** Linie tekstu: pierwsza jak tytuł karty, reszta krótsza — żeby zarys czytał się jak treść, nie jak blok. */
function Lines({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-2">
      <Bone className="h-4 w-2/5" />
      {Array.from({ length: count }, (_, i) => <Bone key={i} className={cn("h-3", i % 2 ? "w-3/5" : "w-4/5")} />)}
    </div>
  );
}

/** Karta-zarys: ta sama ramka, promień i wcięcie co `Card`. */
function SkeletonCard({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn(cardVariant(), "p-card", className)}>{children ?? <Lines />}</div>;
}

function MonthGrid() {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 35 }, (_, i) => (
        <Bone key={i} className="aspect-square sm:aspect-[4/3] rounded-field" />
      ))}
    </div>
  );
}

/**
 * Zarys karty z pulpitu „Dziś” (ładowanej leniwie) — rezerwuje miejsce, zanim paczka dojdzie,
 * więc lista pod nią nie przeskakuje. Ukryty przed 300 ms jak `ViewSkeleton`; dla czytnika
 * ekranu pominięty (to tylko podpowiedź, nie osobny komunikat).
 * `hero` — karta zmiany na górze Dziś: data, znaczek z nazwą zmiany i rząd przycisków.
 */
export function CardSkeleton({ variant = "card" }: { variant?: "card" | "hero" }) {
  return (
    <div aria-hidden className="view-skeleton">
      {variant === "hero" ? (
        <SkeletonCard className="space-y-3">
          <Bone className="h-5 w-48" />
          <div className="flex items-center gap-3">
            <Bone className="size-12 rounded-card" />
            <Bone className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Bone className="h-9 w-28" />
            <Bone className="h-9 w-24" />
          </div>
        </SkeletonCard>
      ) : (
        <SkeletonCard />
      )}
    </div>
  );
}

function ViewBody({ view }: { view: SkeletonView }) {
  switch (view) {
    case "calendar":
    case "shifts":
      return (
        <>
          {/* Pasek nawigacji miesiąca */}
          <div className="flex items-center gap-2">
            <Bone className="size-9 rounded-full" />
            <Bone className="h-6 w-40" />
            <Bone className="size-9 rounded-full" />
            <Bone className="ml-auto h-9 w-24 rounded-full" />
          </div>
          {view === "shifts" && (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonCard key={i}><Bone className="h-3 w-1/2" /><Bone className="mt-2 h-5 w-2/5" /></SkeletonCard>
              ))}
            </div>
          )}
          <MonthGrid />
        </>
      );
    case "study":
      return (
        <>
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-9 w-20 rounded-full" />)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i}><Lines count={3} /></SkeletonCard>)}
          </div>
        </>
      );
    case "debts":
      // Podsumowanie z dwiema liczbami (`Stat`) i lista osób.
      return (
        <>
          <SkeletonCard>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Bone className="h-3 w-24" /><Bone className="h-7 w-28" /></div>
              <div className="flex flex-col items-end space-y-2"><Bone className="h-3 w-24" /><Bone className="h-7 w-28" /></div>
            </div>
            <Bone className="mt-3 h-2 w-full rounded-full" />
          </SkeletonCard>
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonCard key={i} className="flex items-center gap-3">
                <Bone className="size-10 rounded-full" />
                <div className="flex-1 space-y-2"><Bone className="h-4 w-1/3" /><Bone className="h-3 w-1/2" /></div>
                <Bone className="h-5 w-16" />
              </SkeletonCard>
            ))}
          </div>
        </>
      );
    case "cwiczenia":
      // Pasek „dziś” i sekcje-karty z nagłówkiem i wierszami (`SectionCard`).
      return (
        <div className="w-full max-w-(--page-form) space-y-4">
          <Bone className="h-11 w-full rounded-card" />
          {Array.from({ length: 2 }, (_, i) => (
            <SkeletonCard key={i} className="space-y-3">
              <Bone className="h-5 w-1/3" />
              {Array.from({ length: 3 }, (_, j) => <Bone key={j} className="h-10 w-full rounded-field" />)}
            </SkeletonCard>
          ))}
        </div>
      );
    case "plans":
      // Siatka kart z miniaturą rzutu 16:9, jak w `PlansList`.
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={cn(cardVariant(), "overflow-hidden")}>
              <Bone className="aspect-[16/9] w-full rounded-none" />
              <div className="p-card"><Lines count={1} /></div>
            </div>
          ))}
        </div>
      );
    case "week":
      // Oś tygodnia: siedem dni jeden pod drugim.
      return (
        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, i) => (
            <SkeletonCard key={i} className="flex items-center gap-3 py-3">
              <Bone className="h-4 w-16" />
              <Bone className={cn("h-3", i % 3 ? "w-1/3" : "w-1/2")} />
            </SkeletonCard>
          ))}
        </div>
      );
  }
}

export function ViewSkeleton({ view }: { view: SkeletonView }) {
  return (
    <div role="status" aria-live="polite" className="view-skeleton space-y-4" data-testid="view-skeleton">
      <span className="sr-only">{LABELS[view]}</span>
      <div aria-hidden className="space-y-4">
        <ViewBody view={view} />
      </div>
    </div>
  );
}
