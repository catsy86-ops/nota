import { haptic } from "@/lib/haptics";
import { toast } from "sonner";
import { BellRing, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ReminderDueToastProps {
  toastId: string | number;
  title: string;
  /** Kiedy przypomnienie wypadło, np. „dziś, 17:17” — przy otwarciu po czasie to ważne. */
  when: string;
  /** Początek treści notatki; pusty = bez opisu. */
  description: string;
  onOpen: () => void;
  onSnooze10: () => void;
  onSnoozeTomorrow: () => void;
  /** Odłożenie na godzinę (T-4). */
  onSnoozeHour?: () => void;
  /** „Wieczorem” 18:00; brak = po 17:30 pozycji nie ma (`eveningTime`). */
  onSnoozeEvening?: () => void;
  onDone: () => void;
}

/**
 * Przypomnienie, które właśnie wypadło: odhacz, odłóż albo otwórz — jeden rząd,
 * odkładanie w menu. Wcześniej cztery przyciski w dwóch rzędach zajmowały
 * na telefonie piątą część ekranu.
 */
export function ReminderDueToast({ toastId, title, when, description, onOpen, onSnooze10, onSnoozeTomorrow, onSnoozeHour, onSnoozeEvening, onDone }: ReminderDueToastProps) {
  const run = (fn: () => void) => () => { fn(); toast.dismiss(toastId); };
  return (
    // 4.4: karta aplikacji z paskiem stanu z lewej (bursztyn = termin) i dzwonkiem zamiast emoji.
    <div className="relative w-full overflow-hidden rounded-card border border-border/70 bg-card text-foreground shadow-elevation-3 p-3.5 pl-4.5 flex flex-col gap-2.5">
      <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden />
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <BellRing className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
          <span className="text-sm font-semibold truncate">{title}</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{when}</span>
        </div>
        {description && <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</div>}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="coarse:h-11" onClick={() => { haptic("success"); run(onDone)(); }}>Gotowe</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-1 coarse:h-11">Odłóż <ChevronDown className="w-3.5 h-3.5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={run(onSnooze10)}>Za 10 minut</DropdownMenuItem>
            {onSnoozeHour && <DropdownMenuItem onSelect={run(onSnoozeHour)}>Za godzinę</DropdownMenuItem>}
            {onSnoozeEvening && <DropdownMenuItem onSelect={run(onSnoozeEvening)}>Wieczorem (18:00)</DropdownMenuItem>}
            <DropdownMenuItem onSelect={run(onSnoozeTomorrow)}>Jutro rano (9:00)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" className="ml-auto coarse:h-11" onClick={run(onOpen)}>Otwórz</Button>
      </div>
    </div>
  );
}
