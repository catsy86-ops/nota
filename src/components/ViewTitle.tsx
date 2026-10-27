import { lazy, Suspense } from "react";
import { pluralPl } from "@/lib/plural";

// Ozdoba dnia w barwach stylu (plan motywów 2.5) — tylko na Dziś, leniwie.
const DaySignature = lazy(() => import("@/components/skins/DaySignature"));

/** Widoki z własnym blokiem tytułowym (B4): Dziś, Praca, Grafik. Ich h1 w nagłówku jest wtedy ukryty. */
export const TITLE_BLOCK_VIEWS = ["today", "study", "shifts"] as const;
export type TitleBlockView = (typeof TITLE_BLOCK_VIEWS)[number];

const TITLES: Record<TitleBlockView, string> = { today: "Dziś", study: "Praca", shifts: "Grafik" };

export const isTitleBlockView = (view: string): view is TitleBlockView => (TITLE_BLOCK_VIEWS as readonly string[]).includes(view);

/**
 * Tytuł widoku nad treścią: h1 i wiersz mono z dzisiejszą datą. Na Dziś dochodzi liczba notatek.
 * Jedyny h1 na tych widokach (nagłówek go ukrywa), żeby czytnik ekranu nie widział dwóch.
 */
export function ViewTitle({ view, count }: { view: TitleBlockView; count?: number }) {
  const date = new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  return (
    // Siatka: ozdoba dnia stoi w rzędzie tytułu; na telefonie wiersz daty idzie pod spodem przez całą
    // szerokość (inaczej szersze ozdoby — tabliczka Planu — zawijały datę), od `sm` obok tytułu i daty.
    <header className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{TITLES[view]}</h1>
      {view === "today" && (
        <div className="col-start-2 row-start-1 sm:row-span-2">
          <Suspense fallback={null}>
            <DaySignature />
          </Suspense>
        </div>
      )}
      <p className="col-span-2 mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground sm:col-span-1">
        {date}
        {count !== undefined && <span> · {count} {pluralPl(count, ["notatka", "notatki", "notatek"])}</span>}
      </p>
    </header>
  );
}
