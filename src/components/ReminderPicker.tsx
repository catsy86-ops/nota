import { useState } from "react";
import { Bell, Repeat, X } from "lucide-react";
import { formatReminderShort } from "@/lib/reminderTime";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { REMINDER_REPEAT_LABELS, type ReminderRepeat } from "@/lib/reminderRepeat";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { composeReminderTimestamp, isPastReminder, toTimeInputValue, DEFAULT_REMINDER_TIME } from "@/lib/reminderTime";
import { QuickReminderInput } from "@/components/QuickReminderInput";

interface ReminderPickerProps {
  reminder: number | null;
  reminderRepeat?: ReminderRepeat;
  onSet: (timestamp: number | null, repeat: ReminderRepeat) => void;
}

const REPEAT_OPTIONS: ReminderRepeat[] = ["none", "daily", "weekly", "monthly"];

export function ReminderPicker({ reminder, reminderRepeat, onSet }: ReminderPickerProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(reminder ? new Date(reminder) : undefined);
  const [time, setTime] = useState(reminder ? toTimeInputValue(reminder) : DEFAULT_REMINDER_TIME);
  const [repeat, setRepeat] = useState<ReminderRepeat>(reminderRepeat ?? "none");

  function handleQuickParsed(parsed: Date) {
    setDate(parsed);
    setTime(toTimeInputValue(parsed.getTime()));
  }

  // `null` = godzina niepełna (pole `type="time"` da się wyczyścić); wtedy
  // nie ma czego zapisać, a wcześniej szło w dane `NaN`.
  const timestamp = date ? composeReminderTimestamp(date, time) : null;
  const pastTime = isPastReminder(timestamp);

  function handleSave() {
    if (timestamp === null || pastTime) return;
    requestNotificationPermissionOnIntent();
    onSet(timestamp, repeat);
    setOpen(false);
  }

  function handleClear() {
    onSet(null, "none");
    setDate(undefined);
    setTime(DEFAULT_REMINDER_TIME);
    setRepeat("none");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          className={cn(
            "card-action",
            reminder ? "text-primary" : "text-muted-foreground"
          )}
          title="Przypomnienie"
        >
          <Bell className={cn("w-4 h-4", reminder && "fill-current")} />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Przypomnienie</p>
        <QuickReminderInput onParsed={handleQuickParsed} />
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
        {pastTime && (
          <p className="text-2xs text-destructive">Ta godzina już minęła. Wybierz godzinę w przyszłości.</p>
        )}
        <p className="text-2xs text-muted-foreground">
          Działa najpewniej, gdy aplikacja zostaje otwarta w tle — bez serwera powiadomień push, zamknięta karta może dostarczyć przypomnienie dopiero po ponownym otwarciu appki.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={timestamp === null || pastTime} className="flex-1">
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
      "flex items-center gap-1 text-2xs mt-2 px-2 py-0.5 rounded-full w-fit",
      isPast ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
    )}>
      <Bell className="w-2.5 h-2.5" />
      {formatReminderShort(reminder)}
      {reminderRepeat && reminderRepeat !== "none" && <Repeat className="w-2.5 h-2.5" />}
    </div>
  );
}
