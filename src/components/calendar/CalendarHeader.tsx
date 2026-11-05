import { ChevronLeft, ChevronRight, Download, Keyboard, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageActions } from "@/components/PageActions";
import { format, isSameDay, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";

interface CalendarHeaderProps {
  month: Date;
  selectedDay: Date;
  showKeys: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onToggleKeys: () => void;
  onPrint: () => void;
  onExportAll: () => void;
}

/** Pasek miesiąca: strzałki, „Dziś” i skróty; druk i .ics wstawia do akcji główki (nowy plan 1.1, wcześniej menu „⋯” K5.2). */
export function CalendarHeader({ month, selectedDay, showKeys, onPrev, onNext, onToday, onToggleKeys, onPrint, onExportAll }: CalendarHeaderProps) {
  const isThisMonth = isSameMonth(month, new Date());
  return (
    <header className="order-1 flex items-center gap-1 sm:gap-2">
      <button
        onClick={onPrev}
        aria-label="Poprzedni miesiąc"
        className="inline-flex items-center justify-center p-2 coarse:min-h-11 coarse:min-w-11 shrink-0 rounded-card text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <h2
        className="font-display font-bold text-base sm:text-lg capitalize text-center truncate sm:min-w-[11ch]"
      >
        {format(month, "LLLL", { locale: pl })}{" "}
        <span className={month.getFullYear() === new Date().getFullYear() ? "font-normal text-muted-foreground" : undefined}>{format(month, "yyyy")}</span>
      </h2>
      <button
        onClick={onNext}
        aria-label="Następny miesiąc"
        className="inline-flex items-center justify-center p-2 coarse:min-h-11 coarse:min-w-11 shrink-0 rounded-card text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      {/* Przycisk zostaje także wtedy, gdy wybrany dzień jest inny niż dziś, nawet w bieżącym miesiącu. */}
      {(!isThisMonth || !isSameDay(selectedDay, new Date())) && (
        <button
          onClick={onToday}
          aria-label="Dziś: wróć do bieżącego miesiąca"
          className={`ml-1 shrink-0 text-xs font-medium px-2 sm:px-2.5 py-1 coarse:min-h-11 coarse:px-3 rounded-field transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${isThisMonth ? "text-primary-ink hover:bg-primary/10" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
        >
          Dziś
        </button>
      )}
      {/* Ściągawka skrótów w podpowiedzi zamiast stałego tekstu w nagłówku. */}
      <button
        type="button"
        onClick={onToggleKeys}
        aria-expanded={showKeys}
        aria-controls="calendar-keys-hint"
        aria-label="Skróty klawiaturowe kalendarza"
        title="Skróty klawiaturowe"
        className="ml-auto hidden sm:inline-flex p-2 rounded-card text-muted-foreground hover:text-foreground hover:bg-muted/60 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Keyboard className="w-4 h-4" aria-hidden />
      </button>
      {/* Druk i .ics są akcjami działu, więc stoją w główce (nowy plan 1.1); na telefonie jako rząd pod tytułem. */}
      <PageActions>
        <Button variant="ghost" size="sm" onClick={onPrint} aria-label="Drukuj terminy tego miesiąca" title="Drukuj terminy tego miesiąca" className="gap-1.5 coarse:min-h-11">
          <Printer className="h-4 w-4" aria-hidden />Drukuj
        </Button>
        <Button variant="ghost" size="sm" onClick={onExportAll} aria-label="Eksportuj nadchodzące terminy do kalendarza (.ics)" title="Eksportuj nadchodzące terminy do kalendarza (.ics)" className="gap-1.5 coarse:min-h-11">
          <Download className="h-4 w-4" aria-hidden />.ics
        </Button>
      </PageActions>
    </header>
  );
}
