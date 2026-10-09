import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ReminderDueToastProps {
  toastId: string | number;
  title: string;
  /** Kiedy przypomnienie wypadło, np. „dziś, 17:17” — przy otwarciu po czasie to ważne. */
  when: string;
  /** Początek treści notatki; pusty = bez opisu. */
  description: string;
  /** Tylko dla jednorazowych — w serii kolejny termin jest już ustawiony. */
  canSnooze: boolean;
  onOpen: () => void;
  onSnooze10: () => void;
  onSnoozeTomorrow: () => void;
  onDone: () => void;
}

/**
 * Przypomnienie, które właśnie wypadło: odhacz, odłóż albo otwórz — jeden rząd,
 * odkładanie w menu. Wcześniej cztery przyciski w dwóch rzędach zajmowały
 * na telefonie piątą część ekranu.
 */
export function ReminderDueToast({ toastId, title, when, description, canSnooze, onOpen, onSnooze10, onSnoozeTomorrow, onDone }: ReminderDueToastProps) {
  const run = (fn: () => void) => () => { fn(); toast.dismiss(toastId); };
  return (
    <div className="w-full rounded-lg border bg-background text-foreground shadow-lg p-3.5 flex flex-col gap-2.5">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">⏰ {title}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{when}</span>
        </div>
        {description && <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</div>}
      </div>
      <div className="flex items-center gap-2">
        {canSnooze && (
          <>
            <Button size="sm" variant="outline" onClick={run(onDone)}>Gotowe</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1">Odłóż <ChevronDown className="w-3.5 h-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={run(onSnooze10)}>Za 10 minut</DropdownMenuItem>
                <DropdownMenuItem onSelect={run(onSnoozeTomorrow)}>Jutro o 9:00</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        <Button size="sm" className="ml-auto" onClick={run(onOpen)}>Otwórz</Button>
      </div>
    </div>
  );
}
