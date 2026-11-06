import { Download, Keyboard, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthNav } from "@/components/ui/month-nav";
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
      {/* Strzałki i tytuł wspólne z Grafikiem (plan UI 2026-11-06, 3.3); rok szary, gdy bieżący. */}
      <MonthNav
        className="min-w-0 flex-1 sm:flex-none"
        label={<>{format(month, "LLLL", { locale: pl })}{" "}<span className={month.getFullYear() === new Date().getFullYear() ? "font-normal text-muted-foreground" : undefined}>{format(month, "yyyy")}</span></>}
        onPrev={onPrev}
        onNext={onNext}
      />
      {/* Przycisk zostaje także wtedy, gdy wybrany dzień jest inny niż dziś, nawet w bieżącym miesiącu. */}
      {(!isThisMonth || !isSameDay(selectedDay, new Date())) && (
        <Button
          size="sm"
          variant={isThisMonth ? "ghost" : "default"}
          onClick={onToday}
          aria-label="Dziś: wróć do bieżącego miesiąca"
          className={isThisMonth ? "shrink-0 text-primary-ink hover:bg-primary/10 hover:text-primary-ink coarse:min-h-11" : "shrink-0 coarse:min-h-11"}
        >
          Dziś
        </Button>
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
