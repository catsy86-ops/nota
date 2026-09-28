import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ReminderDueToastProps {
  toastId: string | number;
  title: string;
  description: string;
  /** Tylko dla jednorazowych — w serii kolejny termin jest już ustawiony. */
  canSnooze: boolean;
  onOpen: () => void;
  onSnooze10: () => void;
  onSnoozeTomorrow: () => void;
  onDone: () => void;
}

/** Przypomnienie, które właśnie wypadło: otwórz, odłóż albo odhacz. */
export function ReminderDueToast({ toastId, title, description, canSnooze, onOpen, onSnooze10, onSnoozeTomorrow, onDone }: ReminderDueToastProps) {
  const run = (fn: () => void) => () => { fn(); toast.dismiss(toastId); };
  return (
    <div className="w-full rounded-md border bg-background text-foreground shadow-lg p-4 flex flex-col gap-3">
      <div>
        <div className="text-sm font-semibold">⏰ {title}</div>
        <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</div>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        {canSnooze && (
          <>
            <Button size="sm" variant="ghost" onClick={run(onSnooze10)}>Odłóż 10 min</Button>
            <Button size="sm" variant="ghost" onClick={run(onSnoozeTomorrow)}>Jutro 9:00</Button>
            <Button size="sm" variant="outline" onClick={run(onDone)}>Gotowe</Button>
          </>
        )}
        <Button size="sm" onClick={run(onOpen)}>Otwórz</Button>
      </div>
    </div>
  );
}
