import { forwardRef, useEffect, useId, useRef, useState, type HTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";
import { Bell, Repeat, X } from "lucide-react";
import { isSameDay as sameDay } from "date-fns";
import { formatReminderShort } from "@/lib/reminderTime";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LazyCalendar as Calendar } from "@/components/ui/lazy-calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m as motion } from "framer-motion";
import { endOfDay, type RepeatInput, type RepeatRule, type ReminderRepeat } from "@/lib/reminderRepeat";
import { RepeatRuleExtras, RepeatRuleSelect } from "@/components/RepeatRuleFields";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { composeReminderTimestamp, dayInputValue, isPastReminder, toTimeInputValue, DEFAULT_REMINDER_TIME, readLastReminderTime, writeLastReminderTime } from "@/lib/reminderTime";
import { QuickReminderInput } from "@/components/QuickReminderInput";
import { useReminderPassed } from "@/hooks/useReminderPassed";
import { useShifts, type ShiftData } from "@/lib/shifts";
import { shiftPresets } from "@/lib/reminderShiftPresets";

interface ReminderPickerProps {
  reminder: number | null;
  reminderRepeat?: ReminderRepeat;
  /** Pełna reguła powtarzania (3.1); bez niej rodzaj bierzemy z `reminderRepeat`. */
  reminderRule?: RepeatRule;
  reminderRepeatUntil?: number;
  /** Cały dzień: termin to 9:00 wybranego dnia, bez pola godziny. */
  reminderAllDay?: boolean;
  /** `until` — koniec serii (koniec dnia) albo `undefined` = bez końca. `allDay` tylko gdy włączony. */
  onSet: (timestamp: number | null, repeat: RepeatInput, until?: number, allDay?: boolean) => void;
  /** Własny przycisk otwierający (np. w pasku nowej notatki); domyślnie ikona dzwonka z kafla. */
  trigger?: ReactNode;
  /** Każda zmiana (np. z akcji „Przypomnienie” w kompozytorze) otwiera okno; pierwsze renderowanie nie otwiera. */
  openSignal?: number;
}

interface ReminderBadgeProps {
  reminder: number | null;
  reminderRepeat?: ReminderRepeat;
  reminderAllDay?: boolean;
  interactive?: boolean;
}

/** Szybkie terminy: pierwszy przyszły z listy trafia do pól daty i godziny. */
function presets(now = new Date(), shifts?: ShiftData, quickHour = false): { label: string; at: Date }[] {
  const at = (days: number, h: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h, 0, 0, 0);
  // Q4: na telefonie po 8:00 pierwszy szybki termin to „Za godzinę”, zaokrąglony w górę do 5 minut.
  const inAnHour = new Date(now.getTime() + 60 * 60_000);
  inAnHour.setSeconds(0, 0);
  inAnHour.setMinutes(Math.ceil(inAnHour.getMinutes() / 5) * 5);
  const list = [
    ...(quickHour && now.getHours() >= 8 ? [{ label: "Za godzinę", at: inAnHour }] : []),
    { label: "Dziś wieczorem", at: at(0, 18) },
    { label: "Jutro rano", at: at(1, 9) },
    { label: "Za tydzień", at: at(7, 9) },
    ...(shifts ? shiftPresets(shifts, now) : []),
  ];
  return list.filter((p) => p.at.getTime() > now.getTime());
}


/** Chipy dnia (F2.2): offset w dniach od dziś; „Wybierz…” otwiera kalendarz. */
const DAY_CHIPS = [
  { label: "Dziś", days: 0 },
  { label: "Jutro", days: 1 },
  { label: "Pojutrze", days: 2 },
];
/** Chipy godzin (F2.2): ustawiają pole godziny; pole zostaje do dowolnej wartości. */
const HOUR_CHIPS = ["08:00", "12:00", "15:00", "18:00", "20:00"];

const chipClass = "rounded-full border px-2.5 py-1 text-xs transition-colors coarse:min-h-11 coarse:px-3.5 aria-pressed:border-primary/60 aria-pressed:bg-primary/10 aria-pressed:text-primary-ink border-border text-muted-foreground hover:border-primary/60 hover:text-primary-ink";

/**
 * Powłoka pickera (F2.1): na telefonie dolny arkusz, na komputerze dotychczasowy Popover.
 * Treść jest ta sama; zmienia się tylko kontener i to, jak się otwiera.
 */
function ReminderSurface({ open, onOpenChange, trigger, children }: { open: boolean; onOpenChange: (next: boolean) => void; trigger: ReactNode; children: ReactNode }) {
  const mobile = useMediaQuery("(max-width: 639px)");
  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" snap data-reminder-sheet className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-border/60 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-5 space-y-3" onClick={(e) => e.stopPropagation()}>
          <SheetHeader className="sr-only"><SheetTitle>Przypomnienie</SheetTitle></SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto max-w-74 max-h-(--radix-popover-content-available-height) overflow-y-auto p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function ReminderPicker({ reminder, reminderRepeat, reminderRule, reminderRepeatUntil, reminderAllDay, onSet, trigger, openSignal }: ReminderPickerProps) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const [date, setDate] = useState<Date | undefined>(reminder ? new Date(reminder) : undefined);
  const [time, setTime] = useState(reminder ? toTimeInputValue(reminder) : readLastReminderTime());
  const [repeat, setRepeat] = useState<RepeatRule>(reminderRule ?? { kind: reminderRepeat ?? "none" });
  const [allDay, setAllDay] = useState(reminderAllDay === true);
  const [untilText, setUntilText] = useState(reminderRepeatUntil !== undefined ? dayInputValue(reminderRepeatUntil) : "");
  const shifts = useShifts();
  // F2.2: na telefonie kalendarz pokazuje się po „Wybierz…” albo gdy wybrano dzień spoza chipów.
  // Na komputerze jest zawsze (jest na niego miejsce, a testy i nawyki tego oczekują).
  const mobile = useMediaQuery("(max-width: 639px)");
  const [pickingDate, setPickingDate] = useState(false);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const chipDay = (offset: number) => new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + offset);
  const isChipDate = (d: Date | undefined) => !!d && DAY_CHIPS.some((c) => sameDay(d, chipDay(c.days)));
  const showCalendar = !mobile || pickingDate || (!!date && !isChipDate(date));

  /** Przy każdym otwarciu stan wraca do bieżącej notatki — seria mogła przeskoczyć albo ktoś zmienił termin na drugim telefonie. */
  function openChange(next: boolean) {
    if (next) {
      setDate(reminder ? new Date(reminder) : undefined);
      setTime(reminder ? toTimeInputValue(reminder) : readLastReminderTime());
      setRepeat(reminderRule ?? { kind: reminderRepeat ?? "none" });
      setAllDay(reminderAllDay === true);
      setUntilText(reminderRepeatUntil !== undefined ? dayInputValue(reminderRepeatUntil) : "");
      setPickingDate(false);
    }
    setOpen(next);
  }

  // 2.5: sygnał z zewnątrz (akcja „Przypomnienie” w kompozytorze) otwiera okno. Pierwsze renderowanie pomijamy.
  // Picker może zamontować się już po zwiększeniu sygnału, więc startujemy od „nieznany”, a nie od bieżącej wartości.
  const seenSignal = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!openSignal || openSignal === seenSignal.current) return;
    seenSignal.current = openSignal;
    openChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  function handleQuickParsed(parsed: Date) {
    setDate(parsed);
    setTime(toTimeInputValue(parsed.getTime()));
  }

  // Wpisany tekst („jutro 15”) zapisuje się od razu po Enter, gdy termin jest poprawny (QoL: bez drugiego kliku).
  const [saveAfterTyping, setSaveAfterTyping] = useState(false);
  function handleTypedParsed(parsed: Date) {
    handleQuickParsed(parsed);
    setSaveAfterTyping(true);
  }

  // `null` = godzina niepełna (pole `type="time"` da się wyczyścić); wtedy
  // nie ma czego zapisać, a wcześniej szło w dane `NaN`.
  const timestamp = date ? composeReminderTimestamp(date, allDay ? DEFAULT_REMINDER_TIME : time) : null;
  const pastTime = isPastReminder(timestamp);
  const [uy, um, ud] = untilText.split("-").map(Number);
  const until = repeat.kind !== "none" && untilText ? endOfDay(new Date(uy, um - 1, ud)) : undefined;
  // Koniec serii przed pierwszym terminem nie ma sensu — seria nie miałaby żadnego wystąpienia.
  const untilTooEarly = until !== undefined && timestamp !== null && until < timestamp;

  useEffect(() => {
    if (!saveAfterTyping) return;
    setSaveAfterTyping(false);
    if (timestamp === null || untilTooEarly) return;
    requestNotificationPermissionOnIntent();
    if (!allDay) writeLastReminderTime(time);
    onSet(timestamp, repeat, until, allDay || undefined);
    setOpen(false);
  }, [saveAfterTyping, timestamp, untilTooEarly, repeat, until, allDay, onSet]);

  function handleSave() {
    if (timestamp === null || untilTooEarly) return;
    requestNotificationPermissionOnIntent();
    if (!allDay) writeLastReminderTime(time);
    onSet(timestamp, repeat, until, allDay || undefined);
    setOpen(false);
  }

  function handleClear() {
    onSet(null, { kind: "none" }, undefined);
    setUntilText("");
    setDate(undefined);
    setTime(DEFAULT_REMINDER_TIME);
    setRepeat({ kind: "none" });
    setAllDay(false);
    setOpen(false);
  }

  return (
    <ReminderSurface open={open} onOpenChange={openChange} trigger={trigger ?? (
          <motion.button
            aria-label="Przypomnienie"
            className={cn(
              "card-action",
              reminder ? "text-primary-ink" : "text-muted-foreground"
            )}
            title="Przypomnienie"
          >
            <Bell className={cn("w-4 h-4", reminder && "fill-current")} />
          </motion.button>
        )}>
        <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Przypomnienie</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Szybkie terminy">
          {presets(new Date(), shifts, mobile).map((p) => (
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
        <QuickReminderInput
          onParsed={handleTypedParsed}
          onPreview={(d) => { setDate(d); setTime(toTimeInputValue(d.getTime())); }}
        />
        {/* Podgląd (F2.3): to, co zapisze „Zapisz”, zanim klikniesz. */}
        <p aria-live="polite" className="text-xs text-muted-foreground" data-testid="reminder-preview">
          {timestamp !== null
            ? <>Zapiszę: <span className="font-medium text-foreground">{formatReminderShort(timestamp)}</span>{allDay ? " · cały dzień" : ""}</>
            : "Wybierz dzień i godzinę."}
        </p>
        <div role="group" aria-label="Dzień terminu" className="flex flex-wrap gap-1.5">
          {DAY_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              aria-pressed={!!date && sameDay(date, chipDay(c.days))}
              onClick={() => { setDate(chipDay(c.days)); setPickingDate(false); }}
              className={chipClass}
            >
              {c.label}
            </button>
          ))}
          {mobile && (
            <button type="button" aria-pressed={showCalendar} onClick={() => setPickingDate((v) => !v)} className={chipClass}>
              Wybierz…
            </button>
          )}
        </div>
        {/* Przeszłe dni zostają do wyboru (K-1): zapis jest dozwolony z ostrzeżeniem, jak w dialogu Kalendarza (K1.4). */}
        {showCalendar && <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className={cn("p-3 pointer-events-auto")}
        />}
        <label htmlFor={`${uid}-allday`} className="flex items-center gap-2 text-xs text-muted-foreground coarse:min-h-11">
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
              className="max-sm:h-11 text-sm bg-muted/60 border border-border rounded-field px-2 py-1 outline-hidden focus:ring-2 focus:ring-ring text-foreground"
            />
          </div>
        )}
        {!allDay && (
          <div role="group" aria-label="Godzina terminu" className="flex flex-wrap gap-1.5">
            {HOUR_CHIPS.map((h) => (
              <button key={h} type="button" aria-pressed={time === h} onClick={() => setTime(h)} className={chipClass}>
                {h}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label htmlFor={`${uid}-repeat`} className="text-xs text-muted-foreground flex items-center gap-1"><Repeat className="w-3 h-3" />Powtarzaj:</label>
          <RepeatRuleSelect
            id={`${uid}-repeat`}
            value={repeat}
            onChange={setRepeat}
            date={date}
            className="text-xs bg-muted/60 border border-border rounded-field px-2 py-1 outline-hidden focus:ring-2 focus:ring-ring text-foreground"
          />
        </div>
        <RepeatRuleExtras id={uid} value={repeat} onChange={setRepeat} />
        {repeat.kind !== "none" && (
          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-until`} className="text-xs text-muted-foreground">Do kiedy:</label>
            <input
              id={`${uid}-until`}
              type="date"
              value={untilText}
              min={timestamp !== null ? dayInputValue(timestamp) : undefined}
              onChange={(e) => setUntilText(e.target.value)}
              aria-describedby={`${uid}-until-hint`}
              className="max-sm:h-11 text-xs bg-muted/60 border border-border rounded-field px-2 py-1 outline-hidden focus:ring-2 focus:ring-ring text-foreground"
            />
            {untilText && (
              <button type="button" onClick={() => setUntilText("")} aria-label="Bez końca serii" className="p-1 rounded text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {repeat.kind !== "none" && (
          <p id={`${uid}-until-hint`} aria-live="polite" className={cn("text-2xs", untilTooEarly ? "text-destructive-ink" : "text-muted-foreground")}>
            {untilTooEarly ? "Koniec serii musi być po pierwszym terminie." : untilText ? "Ostatni termin serii najpóźniej tego dnia." : "Puste pole — seria bez końca."}
          </p>
        )}
        {pastTime && (
          <p aria-live="polite" className="text-2xs text-destructive-ink">Ten termin jest w przeszłości — przypomnienie odezwie się przy najbliższym otwarciu aplikacji.</p>
        )}
        <p className="text-2xs text-muted-foreground">
          Działa najpewniej, gdy aplikacja zostaje otwarta w tle — bez serwera powiadomień push, zamknięta karta może dostarczyć przypomnienie dopiero po ponownym otwarciu appki.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={timestamp === null || untilTooEarly} className="flex-1">
            Zapisz
          </Button>
          {reminder && (
            <Button size="sm" variant="outline" onClick={handleClear} aria-label="Usuń przypomnienie">
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
    </ReminderSurface>
  );
}

/**
 * Odznaka terminu na kaflu. `interactive`: to przycisk, który otwiera `ReminderPicker` przez `trigger`
 * (edycja godziny z karty bez menu); bez tego zwykły `div` jak dotąd.
 */
export const ReminderBadge = forwardRef<HTMLElement, ReminderBadgeProps & HTMLAttributes<HTMLElement>>(function ReminderBadge(
  { reminder, reminderRepeat, interactive = false, onClick, ...rest },
  ref,
) {
  // Klik w odznakę na kaflu nie może otwierać notatki w edytorze (przycisk żyje w kaflu, który ma własny klik).
  const handleClick = (e: MouseEvent<HTMLElement>) => { e.stopPropagation(); onClick?.(e); };
  const passed = useReminderPassed(reminder ?? 0);
  if (!reminder) return null;
  const className = cn(
    "stamp-tag text-xs mt-2 w-fit",
    passed ? "text-destructive-ink" : "text-primary-ink",
    interactive && "pressable coarse:min-h-11",
  );
  const content = (
    <>
      <Bell className="w-2.5 h-2.5" />
      {passed && <span className="sr-only">Zaległe: </span>}
      {formatReminderShort(reminder)}
      {reminderRepeat && reminderRepeat !== "none" && <Repeat className="w-2.5 h-2.5" />}
    </>
  );
  if (interactive) {
    return (
      <button type="button" ref={ref as Ref<HTMLButtonElement>} className={className} title="Zmień przypomnienie" onClick={handleClick} {...rest}>
        {content}
      </button>
    );
  }
  return (
    <div ref={ref as Ref<HTMLDivElement>} className={className} {...rest}>
      {content}
    </div>
  );
});
