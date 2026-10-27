import { cn } from "@/lib/utils";
import type { LazyView } from "@/lib/viewPreload";

// Zarys widoku ładowanego leniwie (Kalendarz, Grafik, Nauka) — zamiast pustego
// ekranu przy pierwszym wejściu na wolnym łączu. Pojawia się z opóźnieniem
// (`.view-skeleton` w index.css), więc szybkie ładowanie nie mignie szkieletem.

const LABELS: Record<LazyView, string> = {
  calendar: "Ładowanie kalendarza…",
  shifts: "Ładowanie grafiku…",
  study: "Ładowanie Pracy…",
};

function Bone({ className }: { className?: string }) {
  return <div className={cn("view-skeleton-bone rounded-control bg-muted", className)} />;
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
 * więc lista pod nią nie przeskakuje. Ukryty przed 180 ms jak `ViewSkeleton`; dla czytnika
 * ekranu pominięty (to tylko podpowiedź, nie osobny komunikat).
 */
export function CardSkeleton() {
  return (
    <div aria-hidden className="view-skeleton">
      <Bone className="h-24 w-full rounded-card" />
    </div>
  );
}

export function ViewSkeleton({ view }: { view: LazyView }) {
  return (
    <div role="status" aria-live="polite" className="view-skeleton space-y-4" data-testid="view-skeleton">
      <span className="sr-only">{LABELS[view]}</span>
      <div aria-hidden className="space-y-4">
        {/* Pasek nawigacji miesiąca / zakładek */}
        <div className="flex items-center gap-2">
          <Bone className="h-9 w-9 rounded-full" />
          <Bone className="h-6 w-40" />
          <Bone className="h-9 w-9 rounded-full" />
          <Bone className="ml-auto h-9 w-24 rounded-full" />
        </div>
        {view === "study" ? (
          <>
            <div className="flex gap-2">
              {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-9 w-20 rounded-full" />)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => <Bone key={i} className="h-28 rounded-card" />)}
            </div>
          </>
        ) : (
          <>
            {view === "shifts" && (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }, (_, i) => <Bone key={i} className="h-16 rounded-card" />)}
              </div>
            )}
            <MonthGrid />
          </>
        )}
      </div>
    </div>
  );
}
