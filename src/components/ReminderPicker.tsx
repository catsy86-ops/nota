import { useState } from "react";
import { Bell, Repeat, X } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { REMINDER_REPEAT_LABELS, type ReminderRepeat } from "@/lib/reminderRepeat";

interface ReminderPickerProps {
  reminder: number | null;
  reminderRepeat?: ReminderRepeat;
  onSet: (timestamp: number | null, repeat: ReminderRepeat) => void;
}

const REPEAT_OPTIONS: ReminderRepeat[] = ["none", "daily", "weekly", "monthly"];

export function ReminderPicker({ reminder, reminderRepeat, onSet }: ReminderPickerProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(reminder ? new Date(reminder) : undefined);
  const [time, setTime] = useState(reminder ? format(new Date(reminder), "HH:mm") : "09:00");
  const [repeat, setRepeat] = useState<ReminderRepeat>(reminderRepeat ?? "none");

  function handleSave() {
    if (date) {
      const [h, m] = time.split(":").map(Number);
      const d = new Date(date);
      d.setHours(h, m, 0, 0);
      onSet(d.getTime(), repeat);
      setOpen(false);
    }
  }

  function handleClear() {
    onSet(null, "none");
    setDate(undefined);
    setTime("09:00");
    setRepeat("none");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          className={cn(
            "p-1.5 rounded-full hover:bg-foreground/5 transition-colors",
            reminder ? "text-primary" : "text-muted-foreground"
          )}
          title="Przypomnienie"
        >
          <Bell className={cn("w-4 h-4", reminder && "fill-current")} />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Przypomnienie</p>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Godzina:</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1"><Repeat className="w-3 h-3" />Powtarzaj:</label>
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
            className="text-xs bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
          >
            {REPEAT_OPTIONS.map((r) => (
              <option key={r} value={r}>{REMINDER_REPEAT_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={!date} className="flex-1">
            Zapisz
          </Button>
          {reminder && (
            <Button size="sm" variant="outline" onClick={handleClear}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReminderBadge({ reminder, reminderRepeat }: { reminder: number | null; reminderRepeat?: ReminderRepeat }) {
  if (!reminder) return null;
  const isPast = reminder < Date.now();
  return (
    <div className={cn(
      "flex items-center gap-1 text-[10px] mt-2 px-2 py-0.5 rounded-full w-fit",
      isPast ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
    )}>
      <Bell className="w-2.5 h-2.5" />
      {format(new Date(reminder), "d MMM, HH:mm", { locale: pl })}
      {reminderRepeat && reminderRepeat !== "none" && <Repeat className="w-2.5 h-2.5" />}
    </div>
  );
}
