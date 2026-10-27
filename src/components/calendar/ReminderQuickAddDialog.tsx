import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Repeat, Trash, StickyNote, Plus, Bell, SkipForward, X } from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { searchNotes } from "@/lib/searchNotes";
import { parseNaturalDate } from "@/lib/parseNaturalDate";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { composeReminderTimestamp, dayInputValue, isPastReminder, toTimeInputValue, formatReminderShort, defaultReminderTimeFor, DEFAULT_REMINDER_TIME } from "@/lib/reminderTime";
import { endOfDay, REPEAT_KIND_LABELS, type RepeatInput, type RepeatRule } from "@/lib/reminderRepeat";
import { RepeatRuleExtras, RepeatRuleSelect } from "@/components/RepeatRuleFields";
import type { Note } from "@/hooks/useNotes";
import { cn } from "@/lib/utils";

/**
 * Dodawanie i edycja terminu z poziomu kalendarza.
 *
 * Przypomnienie jest polem notatki, więc „dodaj termin na piątek” musi
 * rozstrzygnąć, **na czym** ten termin wisi. Dialog daje dwie drogi bez trybów
 * do przełączania: wpisany tekst tworzy nową notatkę (najczęstszy przypadek —
 * „mam coś do zrobienia w piątek”), a lista pod spodem przypina termin do
 * notatki, która już istnieje.
 */

const MAX_SUGGESTIONS = 6;

/**
 * Na telefonie dialog musi się przewijać: z otwartą klawiaturą ekranową treść
 * przekracza wysokość okna, a bez `max-h` + `overflow-y-auto` przyciski
 * zapisu i usuwania zostają poza widokiem — nieosiągalne, bo okno modalne
 * nie przewija się razem ze stroną. `dvh` zamiast `vh`, bo pasek adresu
 * przeglądarki mobilnej zmienia wysokość widoku w trakcie przewijania.
 */
const DIALOG_CLASS =
  "sm:max-w-md max-h-[85dvh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]";

export interface ReminderEditTarget {
  noteId: string;
  at: number;
  repeat: RepeatRule;
  isSeries: boolean;
  allDay?: boolean;
  /** Termin serii, gdy edytujemy jedno odłożone wystąpienie — zmiana zostaje w tym wystąpieniu, seria nie przesuwa się. */
  base?: number;
  /** Koniec serii (`reminderRepeatUntil`); `undefined` = bez końca. */
  until?: number;
}

interface ReminderQuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dzień klikniętej komórki — punkt startowy dla nowego terminu. */
  day: Date;
  /** Ustawiony, gdy dialog edytuje istniejący termin zamiast dodawać nowy. */
  edit?: ReminderEditTarget | null;
  notes: Note[];
  onCreateNote: (title: string, reminder: number, repeat: RepeatInput, allDay: boolean, until?: number) => void;
  onAttachReminder: (noteId: string, reminder: number, repeat: RepeatInput, allDay: boolean, base: number | undefined, until?: number) => void;
  onClearReminder: (noteId: string) => void;
  /** Pomija najbliższe wystąpienie serii, przesuwając termin na kolejne. */
  onSkipOccurrence: (noteId: string, at: number, repeat: RepeatRule) => void;
}

export function ReminderQuickAddDialog({
  open, onOpenChange, day, edit, notes, onCreateNote, onAttachReminder, onClearReminder, onSkipOccurrence,
}: ReminderQuickAddDialogProps) {
  const editedNote = edit ? notes.find((n) => n.id === edit.noteId) : undefined;

  const [query, setQuery] = useState("");
  const [time, setTime] = useState(() => (edit ? toTimeInputValue(edit.at) : defaultReminderTimeFor(day)));
  const [repeat, setRepeat] = useState<RepeatRule>(() => edit?.repeat ?? { kind: "none" });
  // Cały dzień: termin stoi na 9:00 i nie pokazuje godziny (2d planu, jak w `ReminderPicker`).
  const [allDay, setAllDay] = useState(() => edit?.allDay === true);
  // Koniec serii jak w `ReminderPicker`: pusty = bez końca, dzień włącznie.
  const [untilText, setUntilText] = useState(() => (edit?.until !== undefined ? dayInputValue(edit.until) : ""));
  // Dzień może przesunąć język naturalny („jutro”, „w piątek”) wpisany w pole.
  const [dayOverride, setDayOverride] = useState<Date | null>(null);
  // Ręczna zmiana pola godziny wygrywa z godziną z języka naturalnego („jutro 15:00”) — K0.2.
  const [timeTouched, setTimeTouched] = useState(false);

  const isEdit = !!edit;

  // Dialog zostaje zamontowany: przy każdym otwarciu na nowy dzień godzina startowa liczy się od nowa.
  useEffect(() => {
    if (open && !edit) setTime(defaultReminderTimeFor(day));
  }, [open, day, edit]);

  /**
   * Język naturalny bierzemy z **początku** wpisu: „jutro zadzwonić do Ani”
   * ma dać termin na jutro i tytuł „zadzwonić do Ani”. Gdy nic się nie parsuje,
   * całość zostaje tytułem — nie zgadujemy.
   */
  const parsed = useMemo(() => {
    const words = query.trim().split(/\s+/).filter(Boolean);
    // Od najkrótszego prefiksu: `parseNaturalDate` znajduje datę także w dłuższym
    // zdaniu, więc szukanie od najdłuższego zjadłoby cały wpis jako „datę”
    // i zostawiło notatkę bez tytułu.
    for (let take = 1; take <= Math.min(3, words.length); take++) {
      const head = words.slice(0, take).join(" ");
      const date = parseNaturalDate(head);
      if (!date) continue;
      // Godzina zaraz po dacie („jutro 15:00 dentysta”, „jutro o 15 dentysta”) zostaje w polu czasu, nie w tytule.
      // Samotna liczba („jutro 2 kupić”) to nie godzina — wymagamy „:” / minut albo słowa „o”.
      let end = take;
      let clock: string | null = null;
      const withO = /^o$/i.test(words[end] ?? "");
      const at = withO ? end + 1 : end;
      const m = at < words.length ? /^(\d{1,2})(?::(\d{2}))?$/.exec(words[at]) : null;
      if (m && Number(m[1]) <= 23 && (m[2] !== undefined || withO)) {
        clock = `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`;
        end = at + 1;
      }
      return { date, title: words.slice(end).join(" "), clock };
    }
    return null;
  }, [query]);

  const effectiveDay = dayOverride ?? parsed?.date ?? day;
  const title = (parsed ? parsed.title : query).trim();
  // Pole pokazuje dokładnie tę godzinę, którą zapisze (K0.2).
  const effectiveTime = !timeTouched && parsed?.clock ? parsed.clock : time;
  const timestamp = composeReminderTimestamp(effectiveDay, allDay ? DEFAULT_REMINDER_TIME : effectiveTime);
  const past = isPastReminder(timestamp);
  const [uy, um, ud] = untilText.split("-").map(Number);
  const until = repeat.kind !== "none" && untilText ? endOfDay(new Date(uy, um - 1, ud)) : undefined;
  const untilTooEarly = until !== undefined && timestamp !== null && until < timestamp;

  const suggestions = useMemo(() => {
    if (isEdit) return [];
    const pool = notes.filter((n) => !n.trashed && !n.archived);
    const found = query.trim() ? searchNotes(pool, title || query) : pool;
    // Notatki bez terminu na górze — przypięcie do nich niczego nie nadpisze.
    return [...found]
      .sort((a, b) => Number(!!a.reminder) - Number(!!b.reminder) || b.updatedAt - a.updatedAt)
      .slice(0, MAX_SUGGESTIONS);
  }, [isEdit, notes, query, title]);

  function reset() {
    setQuery("");
    setTime(defaultReminderTimeFor(day));
    setTimeTouched(false);
    setRepeat({ kind: "none" });
    setAllDay(false);
    setUntilText("");
    setDayOverride(null);
  }

  function close() {
    onOpenChange(false);
    reset();
  }

  function handleCreate() {
    if (timestamp === null || !title || untilTooEarly) return;
    requestNotificationPermissionOnIntent();
    onCreateNote(title, timestamp, repeat, allDay, until);
    close();
  }

  function handleAttach(noteId: string) {
    if (timestamp === null || untilTooEarly) return;
    requestNotificationPermissionOnIntent();
    onAttachReminder(noteId, timestamp, repeat, allDay, undefined, until);
    close();
  }

  function handleSaveEdit() {
    if (!edit || timestamp === null || untilTooEarly) return;
    requestNotificationPermissionOnIntent();
    onAttachReminder(edit.noteId, timestamp, repeat, allDay, edit.base, until);
    close();
  }

  function handleDelete() {
    if (!edit) return;
    onClearReminder(edit.noteId);
    close();
  }

  function handleSkip() {
    if (!edit) return;
    onSkipOccurrence(edit.noteId, edit.at, edit.repeat);
    close();
  }

  /**
   * Ctrl/⌘+Enter z dowolnego pola okna (także godziny i powtarzania) zapisuje — to samo co
   * główny przycisk. Zwykły Enter zostaje w polu tekstu jak dotąd.
   */
  function handleShortcut(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    if (timestamp === null || untilTooEarly) return;
    if (isEdit) handleSaveEdit();
    else if (title) handleCreate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <ResponsiveDialogContent
        className={DIALOG_CLASS}
        onOpenAutoFocus={isEdit ? (e) => e.preventDefault() : undefined}
        onKeyDown={handleShortcut}
      >
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary-ink" />
            {isEdit ? "Termin przypomnienia" : "Nowy termin"}
          </DialogTitle>
          <DialogDescription className="first-letter:uppercase">
            {isEdit
              ? editedNote?.title?.trim() || "Notatka bez tytułu"
              : format(effectiveDay, "EEEE, d MMMM yyyy", { locale: pl })}
          </DialogDescription>
        </DialogHeader>

        {!isEdit && (
          <div className="space-y-1.5">
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setDayOverride(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && title) { e.preventDefault(); handleCreate(); } }}
              placeholder="Co masz do zrobienia?"
              aria-label="Treść nowej notatki z terminem"
              className="w-full bg-muted/60 border border-border rounded-card px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            />
            {parsed && (
              <p className="text-xs text-muted-foreground">
                Rozpoznano datę: <span className="text-primary-ink font-medium">{format(parsed.date, "d MMMM", { locale: pl })}</span>
                {parsed.clock && !timeTouched && <> o <span className="text-primary-ink font-medium tabular-nums">{parsed.clock}</span></>}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-primary" />
            Cały dzień
          </label>
          {/* W edycji dzień zmienia się tutaj, a nie przez przeciąganie — telefon tego nie obsługuje (P0 planu). */}
          {isEdit && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Dzień:
              <input
                type="date"
                value={format(effectiveDay, "yyyy-MM-dd")}
                onChange={(e) => {
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  if (y && m && d) setDayOverride(new Date(y, m - 1, d));
                }}
                aria-label="Dzień przypomnienia"
                className="text-sm bg-muted/60 border border-border rounded-field px-2 py-1 coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring text-foreground"
              />
            </label>
          )}
          {!allDay && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Godzina:
            <input
              type="time"
              value={effectiveTime}
              onChange={(e) => { setTime(e.target.value); setTimeTouched(true); }}
              aria-label="Godzina przypomnienia"
              className="text-sm bg-muted/60 border border-border rounded-field px-2 py-1 coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring text-foreground"
            />
          </label>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Repeat className="w-3 h-3" />
            <span className="sr-only">Powtarzanie</span>
            <RepeatRuleSelect
              id="quick-add-repeat"
              value={repeat}
              onChange={setRepeat}
              date={timestamp !== null ? new Date(timestamp) : day}
              ariaLabel="Powtarzanie"
              className="text-xs bg-muted/60 border border-border rounded-field px-2 py-1 coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring text-foreground"
            />
          </label>
        </div>
        <RepeatRuleExtras id="quick-add-repeat" value={repeat} onChange={setRepeat} />

        {repeat.kind !== "none" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <label htmlFor="quick-add-until">Do kiedy:</label>
            <input
              id="quick-add-until"
              type="date"
              value={untilText}
              min={timestamp !== null ? dayInputValue(timestamp) : undefined}
              onChange={(e) => setUntilText(e.target.value)}
              aria-describedby="quick-add-until-hint"
              className="text-xs bg-muted/60 border border-border rounded-field px-2 py-1 coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring text-foreground"
            />
            {untilText && (
              <button type="button" onClick={() => setUntilText("")} aria-label="Bez końca serii" className="p-1 rounded text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {repeat.kind !== "none" && (
          <p id="quick-add-until-hint" className={cn("text-2xs", untilTooEarly ? "text-destructive-ink" : "text-muted-foreground")}>
            {untilTooEarly ? "Koniec serii musi być po pierwszym terminie." : untilText ? "Ostatni termin serii najpóźniej tego dnia." : "Puste pole — seria bez końca."}
          </p>
        )}

        {/* Godzina wpisana poprawnie, ale nieistniejąca tego dnia (przeskok zmiany czasu): zapis jest zablokowany, więc mówimy dlaczego. */}
        {time && timestamp === null && /^\d{1,2}:\d{2}$/.test(time) && (
          <p className="text-xs text-destructive-ink">Tej godziny nie ma tego dnia — przestawiono zegar (zmiana czasu). Wybierz inną.</p>
        )}

        {past && (
          <p className="text-xs text-destructive-ink">
            Ten termin jest w przeszłości — przypomnienie odezwie się przy najbliższym otwarciu aplikacji.
          </p>
        )}

        {isEdit ? (
          <div className="space-y-2">
            {edit?.isSeries && (
              <p className="text-xs text-muted-foreground">
                To najbliższy termin serii „{REPEAT_KIND_LABELS[edit.repeat.kind].toLowerCase()}”.
                {edit.base !== undefined
                  ? "Zmiana zostaje w tym jednym wystąpieniu, reszta serii bez zmian."
                  : "Zmiana godziny lub dnia przesuwa całą serię — model zapisuje jeden termin, a kolejne wylicza od niego."}
              </p>
            )}
            <Button size="sm" onClick={handleSaveEdit} disabled={timestamp === null || untilTooEarly} className="w-full coarse:h-11" aria-keyshortcuts="Control+Enter Meta+Enter">
              Zapisz termin
            </Button>
            <div className="flex flex-col sm:flex-row gap-2">
              {edit?.isSeries && (
                <Button size="sm" variant="outline" onClick={handleSkip} className="flex-1">
                  <SkipForward className="w-3.5 h-3.5 mr-1" />
                  Pomiń to wystąpienie
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                className="flex-1 text-destructive-ink hover:text-destructive-ink"
              >
                <Trash className="w-3.5 h-3.5 mr-1" />
                {edit?.isSeries ? "Usuń całą serię" : "Usuń termin"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button size="sm" onClick={handleCreate} disabled={timestamp === null || !title || untilTooEarly} className="w-full coarse:h-11" aria-keyshortcuts="Control+Enter Meta+Enter">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Utwórz notatkę z terminem
            </Button>

            {suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  albo przypnij do istniejącej
                </p>
                <ul className="space-y-1 max-h-44 overflow-y-auto">
                  {suggestions.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleAttach(n.id)}
                        disabled={timestamp === null}
                        className={cn(
                          "w-full flex items-center gap-2 text-left rounded-field px-2 py-1.5 coarse:min-h-11 text-sm",
                          "hover:bg-muted/60 transition-colors disabled:opacity-50 outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <StickyNote className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{n.locked ? "Notatka prywatna" : n.title.trim() || n.content.slice(0, 40) || "Bez tytułu"}</span>
                        {n.reminder && (
                          <span className="ml-auto shrink-0 text-2xs text-muted-foreground">
                            zastąpi termin: {formatReminderShort(n.reminder)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </ResponsiveDialogContent>
    </Dialog>
  );
}
