import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MonthNavProps {
  /** Nazwa okresu, np. „listopad 2026” albo zakres tygodnia. */
  label: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  prevLabel?: string;
  nextLabel?: string;
  /** Stuknięcie w tytuł wraca do bieżącego okresu; bez tego tytuł jest zwykłym tekstem. */
  onCurrent?: () => void;
  currentHint?: string;
  /** Nazwa miesiąca z wielkiej litery (date-fns zwraca małą). */
  capitalize?: boolean;
  className?: string;
  /** Dodatki po prawej (np. „Dziś”, Cofnij/Ponów). */
  children?: ReactNode;
}

const ARROW = "h-10 w-10 text-muted-foreground coarse:h-11 coarse:w-11 [&_svg]:size-5";

/**
 * Jedna nawigacja okresu dla Kalendarza i Grafiku (plan UI 2026-11-06, 1.4): strzałki 40 px (44 na dotyku),
 * tytuł w h2 — jako przycisk „wróć do bieżącego”, gdy jest `onCurrent`.
 */
export function MonthNav({ label, onPrev, onNext, prevLabel = "Poprzedni miesiąc", nextLabel = "Następny miesiąc", onCurrent, currentHint = "Wróć do bieżącego miesiąca", capitalize = true, className, children }: MonthNavProps) {
  const title = cn("truncate font-display text-base font-semibold sm:text-lg", capitalize && "capitalize");
  return (
    <div className={cn("flex items-center gap-1 sm:gap-2", className)}>
      <Button type="button" variant="ghost" size="icon" onClick={onPrev} aria-label={prevLabel} className={ARROW}>
        <ChevronLeft />
      </Button>
      <h2 className="min-w-0 flex-1 text-center sm:min-w-48 sm:flex-none">
        {onCurrent ? (
          <Button type="button" variant="ghost" onClick={onCurrent} title={currentHint} className={cn("w-full px-2 coarse:h-11 sm:px-3", title)}>
            <span className="truncate">{label}</span>
          </Button>
        ) : (
          <span className={cn("block px-2", title)}>{label}</span>
        )}
      </h2>
      <Button type="button" variant="ghost" size="icon" onClick={onNext} aria-label={nextLabel} className={ARROW}>
        <ChevronRight />
      </Button>
      {children}
    </div>
  );
}
