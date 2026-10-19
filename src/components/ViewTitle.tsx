import { pluralPl } from "@/lib/plural";

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
    <header className="w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{TITLES[view]}</h1>
      <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {date}
        {count !== undefined && <span> · {count} {pluralPl(count, ["notatka", "notatki", "notatek"])}</span>}
      </p>
    </header>
  );
}
