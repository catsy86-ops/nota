import { useId, useState, type ReactNode } from "react";
import { Bell, Repeat, X } from "lucide-react";
import { formatReminderShort } from "@/lib/reminderTime";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LazyCalendar as Calendar } from "@/components/ui/lazy-calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m as motion } from "framer-motion";
import { REMINDER_REPEAT_LABELS, endOfDay, type ReminderRepeat } from "@/lib/reminderRepeat";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { composeReminderTimestamp, dayInputValue, isPastReminder, toTimeInputValue, DEFAULT_REMINDER_TIME } from "@/lib/reminderTime";
import { QuickReminderInput } from "@/components/QuickReminderInput";
import { useReminderPassed } from "@/hooks/useReminderPassed";

interface ReminderPickerProps {
  reminder: number | null;
  reminderRepeat?: ReminderRepeat;
  reminderRepeatUntil?: number;
  /** Cały dzień: termin to 9:00 wybranego dnia, bez pola godziny. */
  reminderAllDay?: boolean;
  /** `until` — koniec serii (koniec dnia) albo `undefined` = bez końca. `allDay` tylko gdy włączony. */
  onSet: (timestamp: number | null, repeat: ReminderRepeat, until?: number, allDay?: boolean) => void;
  /** Własny przycisk otwierający (np. w pasku nowej notatki); domyślnie ikona dzwonka z kafla. */
  trigger?: ReactNode;
}

/** Szybkie terminy: pierwszy przyszły z listy trafia do pól daty i godziny. */
function presets(now = new Date()): { label: string; at: Date }[] {
  const at = (days: number, h: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h, 0, 0, 0);
  const list = [
    { label: "Dziś wieczorem", at: at(0, 18) },
    { label: "Jutro rano", at: at(1, 9) },
    { label: "Za tydzień", at: at(7, 9) },
  ];
  return list.filter((p) => p.at.getTime() > now.getTime());
}


const REPEAT_OPTIONS: ReminderRepeat[] = ["none", "daily", "weekly", "monthly"];

export function ReminderPicker({ reminder, reminderRepeat, reminderRepeatUntil, reminderAllDay, onSet, trigger }: ReminderPickerProps) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const [date, setDate] = useState<Date | undefined>(reminder ? new Date(reminder) : undefined);
  const [time, setTime] = useState(reminder ? toTimeInputValue(reminder) : DEFAULT_REMINDER_TIME);
  const [repeat, setRepeat] = useState<ReminderRepeat>(reminderRepeat ?? "none");
  const [allDay, setAllDay] = useState(reminderAllDay === true);
  const [untilText, setUntilText] = useState(reminderRepeatUntil !== undefined ? dayInputValue(reminderRepeatUntil) : "");

  /** Przy każdym otwarciu stan wraca do bieżącej notatki — seria mogła przeskoczyć albo ktoś zmienił termin na drugim telefonie. */
  function openChange(next: boolean) {
    if (next) {
      setDate(reminder ? new Date(reminder) : undefined);
      setTime(reminder ? toTimeInputValue(reminder) : DEFAULT_REMINDER_TIME);
      setRepeat(reminderRepeat ?? "none");
      setAllDay(reminderAllDay === true);
      setUntilText(reminderRepeatUntil !== undefined ? dayInputValue(reminderRepeatUntil) : "");
    }
    setOpen(next);
  }

  function handleQuickParsed(parsed: Date) {
    setDate(parsed);
    setTime(toTimeInputValue(parsed.getTime()));
  }

  // `null` = godzina niepełna (pole `type="time"` da się wyczyścić); wtedy
  // nie ma czego zapisać, a wcześniej szło w dane `NaN`.
  const timestamp = date ? composeReminderTimestamp(date, allDay ? DEFAULT_REMINDER_TIME : time) : null;
  const pastTime = isPastReminder(timestamp);
  const [uy, um, ud] = untilText.split("-").map(Number);
  const until = repeat !== "none" && untilText ? endOfDay(new Date(uy, um - 1, ud)) : undefined;
  // Koniec serii przed pierwszym terminem nie ma sensu — seria nie miałaby żadnego wystąpienia.
  const untilTooEarly = until !== undefined && timestamp !== null && until < timestamp;

  function handleSave() {
    if (timestamp === null || pastTime || untilTooEarly) return;
    requestNotificationPermissionOnIntent();
    onSet(timestamp, repeat, until, allDay || undefined);
    setOpen(false);
  }

  function handleClear() {
    onSet(null, "none", undefined);
    setUntilText("");
    setDate(undefined);
    setTime(DEFAULT_REMINDER_TIME);
    setRepeat("none");
    setAllDay(false);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <motion.button
            className={cn(
              "card-action",
              reminder ? "text-primary-ink" : "text-muted-foreground"
            )}
            title="Przypomnienie"
          >
            <Bell className={cn("w-4 h-4", reminder && "fill-current")} />
          </motion.button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-74 max-h-(--radix-popover-content-available-height) overflow-y-auto p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Przypomnienie</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Szybkie terminy">
          {presets().map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleQuickParsed(p.at)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary-ink coarse:min-h-11 coarse:px-3.5"
            >
              {p.label}
            </button>
          ))}
        </div>
        <QuickReminderInput onParsed={handleQuickParsed} />
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
          className={cn("p-3 pointer-events-auto")}
        />
        <label htmlFor={`${uid}-allday`} className="flex items-center gap-2 text-xs text-muted-foreground">
          <input id={`${uid}-allday`} type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-primary" />
          Cały dzień (o 9:00)
        </label>
        {!allDay && (
          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-time`} className="text-xs text-muted-foreground">Godzina:</label>
            <input
              id={`${uid}-time`}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-hidden focus:ring-1 focus:ring-primary/30 text-foreground"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <label htmlFor={`${uid}-repeat`} className="text-xs text-muted-foreground flex items-center gap-1"><Repeat className="w-3 h-3" />Powtarzaj:</label>
          <select
            id={`${uid}-repeat`}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
            className="text-xs bg-muted/60 border border-border rounded-lg px-2 py-1 outline-hidden focus:ring-1 focus:ring-primary/30 text-foreground"
          >
            {REPEAT_OPTIONS.map((r) => (
              <option key={r} value={r}>{REMINDER_REPEAT_LABELS[r]}</option>
            ))}
          </select>
        </div>
        {repeat !== "none" && (
          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-until`} className="text-xs text-muted-foreground">Do kiedy:</label>
            <input
              id={`${uid}-until`}
              type="date"
              value={untilText}
              min={timestamp !== null ? dayInputValue(timestamp) : undefined}
              onChange={(e) => setUntilText(e.target.value)}
              aria-describedby={`${uid}-until-hint`}
              className="text-xs bg-muted/60 border border-border rounded-lg px-2 py-1 outline-hidden focus:ring-1 focus:ring-primary/30 text-foreground"
            />
            {untilText && (
              <button type="button" onClick={() => setUntilText("")} aria-label="Bez końca serii" className="p-1 rounded text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {repeat !== "none" && (
          <p id={`${uid}-until-hint`} className={cn("text-2xs", untilTooEarly ? "text-destructive-ink" : "text-muted-foreground")}>
            {untilTooEarly ? "Koniec serii musi być po pierwszym terminie." : untilText ? "Ostatni termin serii najpóźniej tego dnia." : "Puste pole — seria bez końca."}
          </p>
        )}
        {pastTime && (
          <p className="text-2xs text-destructive-ink">{allDay ? "Ten dzień już minął. Wybierz dzień w przyszłości." : "Ta godzina już minęła. Wybierz godzinę w przyszłości."}</p>
        )}
        <p className="text-2xs text-muted-foreground">
          Działa najpewniej, gdy aplikacja zostaje otwarta w tle — bez serwera powiadomień push, zamknięta karta może dostarczyć przypomnienie dopiero po ponownym otwarciu appki.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={timestamp === null || pastTime || untilTooEarly} className="flex-1">
            Zapisz
          </Button>
          {reminder && (
            <Button size="sm" variant="outline" onClick={handleClear} aria-label="Usuń przypomnienie">
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReminderBadge({ reminder, reminderRepeat, reminderAllDay }: { reminder: number | null; reminderRepeat?: ReminderRepeat; reminderAllDay?: boolean }) {
  const passed = useReminderPassed(reminder ?? 0);
  if (!reminder) return null;
  return (
    <div className={cn(
      "stamp-tag text-xs mt-2 w-fit",
      passed ? "text-destructive-ink" : "text-primary-ink"
    )}>
      <Bell className="w-2.5 h-2.5" />
      {passed && <span className="sr-only">Zaległe: </span>}
      {formatReminderShort(reminder, new Date(), reminderAllDay === true)}
      {reminderRepeat && reminderRepeat !== "none" && <Repeat className="w-2.5 h-2.5" />}
    </div>
  );
}
