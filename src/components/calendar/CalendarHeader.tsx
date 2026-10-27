import { ChevronLeft, ChevronRight, Download, Keyboard, MoreHorizontal, Printer } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

/** Nagłówek kalendarza: miesiąc i strzałki, „Dziś”, .ics, skróty, wydruk; na telefonie menu „⋯” (K5.2). */
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
        aria-live="polite"
        className="font-display font-bold text-base sm:text-lg capitalize text-center truncate sm:min-w-[11ch]"
      >
        {format(month, "LLLL yyyy", { locale: pl })}
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
          aria-label="Wróć do bieżącego miesiąca"
          className="ml-1 shrink-0 text-xs font-medium text-primary-ink hover:bg-primary/10 px-2 sm:px-2.5 py-1 coarse:min-h-11 coarse:px-3 rounded-field transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          Dziś
        </button>
      )}
      {/* Na telefonie „.ics” i „Drukuj” są w menu „⋯” — nagłówek ma miejsce tylko na strzałki i miesiąc. */}
      <button
        onClick={onExportAll}
        aria-label="Eksportuj nadchodzące terminy do kalendarza (.ics)"
        title="Eksportuj nadchodzące terminy do kalendarza (.ics)"
        className="ml-auto sm:ml-0 order-last shrink-0 hidden sm:inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 py-1.5 coarse:min-h-11 coarse:min-w-11 coarse:justify-center rounded-field transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">.ics</span>
      </button>
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
      <button
        type="button"
        onClick={onPrint}
        aria-label="Drukuj terminy tego miesiąca"
        title="Drukuj terminy tego miesiąca"
        className="shrink-0 hidden sm:inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 py-1.5 coarse:min-h-11 coarse:min-w-11 coarse:justify-center rounded-field transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Printer className="w-3.5 h-3.5" aria-hidden />
        <span>Drukuj</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Więcej akcji kalendarza"
            title="Więcej akcji"
            className="ml-auto order-last shrink-0 sm:hidden coarse:min-h-11 coarse:min-w-11 inline-flex items-center justify-center p-2 rounded-field text-muted-foreground hover:text-foreground hover:bg-muted/60 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="w-4 h-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => onExportAll()}>
            <Download className="w-4 h-4 mr-2" aria-hidden />
            Pobierz .ics (nadchodzące terminy)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onPrint}>
            <Printer className="w-4 h-4 mr-2" aria-hidden />
            Drukuj terminy miesiąca
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
