import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ReminderToastProps {
  toastId: string | number;
  title: string;
  description?: string;
  onShow: () => void;
  onSnooze: () => void;
}

export function ReminderToast({ toastId, title, description, onShow, onSnooze }: ReminderToastProps) {
  const dismiss = () => toast.dismiss(toastId);
  return (
    <div className="w-full rounded-md border bg-background text-foreground shadow-lg p-4 flex flex-col gap-3">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {description && <div className="text-sm text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { dismiss(); }}
        >
          Nie teraz
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { onSnooze(); dismiss(); }}
        >
          💤 Drzemka 10 min
        </Button>
        <Button
          size="sm"
          onClick={() => { onShow(); dismiss(); }}
        >
          Pokaż
        </Button>
      </div>
    </div>
  );
}
