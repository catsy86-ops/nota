import { useMemo, useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Repeat, Trash2, StickyNote, Plus, Bell, SkipForward } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { searchNotes } from "@/lib/searchNotes";
import { parseNaturalDate } from "@/lib/parseNaturalDate";
import { composeReminderTimestamp, isPastReminder, toTimeInputValue, DEFAULT_REMINDER_TIME } from "@/lib/reminderTime";
import { REMINDER_REPEAT_LABELS, type ReminderRepeat } from "@/lib/reminderRepeat";
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

const REPEAT_OPTIONS: ReminderRepeat[] = ["none", "daily", "weekly", "monthly"];
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
  repeat: ReminderRepeat;
  isSeries: boolean;
}

interface ReminderQuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dzień klikniętej komórki — punkt startowy dla nowego terminu. */
  day: Date;
  /** Ustawiony, gdy dialog edytuje istniejący termin zamiast dodawać nowy. */
  edit?: ReminderEditTarget | null;
  notes: Note[];
  onCreateNote: (title: string, reminder: number, repeat: ReminderRepeat) => void;
  onAttachReminder: (noteId: string, reminder: number, repeat: ReminderRepeat) => void;
  onClearReminder: (noteId: string) => void;
  /** Pomija najbliższe wystąpienie serii, przesuwając termin na kolejne. */
  onSkipOccurrence: (noteId: string, at: number, repeat: ReminderRepeat) => void;
}

export function ReminderQuickAddDialog({
  open, onOpenChange, day, edit, notes, onCreateNote, onAttachReminder, onClearReminder, onSkipOccurrence,
}: ReminderQuickAddDialogProps) {
  const editedNote = edit ? notes.find((n) => n.id === edit.noteId) : undefined;

  const [query, setQuery] = useState("");
  const [time, setTime] = useState(() => (edit ? toTimeInputValue(edit.at) : DEFAULT_REMINDER_TIME));
  const [repeat, setRepeat] = useState<ReminderRepeat>(() => edit?.repeat ?? "none");
  // Dzień może przesunąć język naturalny („jutro”, „w piątek”) wpisany w pole.
  const [dayOverride, setDayOverride] = useState<Date | null>(null);

  const isEdit = !!edit;

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
      if (date) return { date, title: words.slice(take).join(" ") };
    }
    return null;
  }, [query]);

  const effectiveDay = dayOverride ?? parsed?.date ?? day;
  const title = (parsed ? parsed.title : query).trim();
  const timestamp = composeReminderTimestamp(effectiveDay, time);
  const past = isPastReminder(timestamp);

  const suggestions = useMemo(() => {
    if (isEdit) return [];
    const pool = notes.filter((n) => !n.trashed);
    const found = query.trim() ? searchNotes(pool, title || query) : pool;
    // Notatki bez terminu na górze — przypięcie do nich niczego nie nadpisze.
    return [...found]
      .sort((a, b) => Number(!!a.reminder) - Number(!!b.reminder) || b.updatedAt - a.updatedAt)
      .slice(0, MAX_SUGGESTIONS);
  }, [isEdit, notes, query, title]);

  function reset() {
    setQuery("");
    setTime(DEFAULT_REMINDER_TIME);
    setRepeat("none");
    setDayOverride(null);
  }

  function close() {
    onOpenChange(false);
    reset();
  }

  function handleCreate() {
    if (timestamp === null || !title) return;
    onCreateNote(title, timestamp, repeat);
    close();
  }

  function handleAttach(noteId: string) {
    if (timestamp === null) return;
    onAttachReminder(noteId, timestamp, repeat);
    close();
  }

  function handleSaveEdit() {
    if (!edit || timestamp === null) return;
    onAttachReminder(edit.noteId, timestamp, repeat);
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

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent
        className={DIALOG_CLASS}
        onOpenAutoFocus={isEdit ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
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
              className="w-full bg-muted/60 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30"
            />
            {parsed && (
              <p className="text-[11px] text-muted-foreground">
                Rozpoznano datę: <span className="text-primary font-medium">{format(parsed.date, "d MMMM", { locale: pl })}</span>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Godzina:
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Godzina przypomnienia"
              className="text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Repeat className="w-3 h-3" />
            <span className="sr-only">Powtarzanie</span>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
              aria-label="Powtarzanie"
              className="text-xs bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
            >
              {REPEAT_OPTIONS.map((r) => (
                <option key={r} value={r}>{REMINDER_REPEAT_LABELS[r]}</option>
              ))}
            </select>
          </label>
        </div>

        {past && (
          <p className="text-[11px] text-destructive">
            Ten termin jest w przeszłości — przypomnienie odezwie się przy najbliższym otwarciu aplikacji.
          </p>
        )}

        {isEdit ? (
          <div className="space-y-2">
            {edit?.isSeries && (
              <p className="text-[11px] text-muted-foreground">
                To najbliższy termin serii „{REMINDER_REPEAT_LABELS[edit.repeat].toLowerCase()}”.
                Zmiana godziny lub dnia przesuwa całą serię — model zapisuje jeden termin,
                a kolejne wylicza od niego.
              </p>
            )}
            <Button size="sm" onClick={handleSaveEdit} disabled={timestamp === null} className="w-full">
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
                className="flex-1 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                {edit?.isSeries ? "Usuń całą serię" : "Usuń termin"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button size="sm" onClick={handleCreate} disabled={timestamp === null || !title} className="w-full">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Utwórz notatkę z terminem
            </Button>

            {suggestions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  albo przypnij do istniejącej
                </p>
                <ul className="space-y-1 max-h-44 overflow-y-auto">
                  {suggestions.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleAttach(n.id)}
                        disabled={timestamp === null}
                        className={cn(
                          "w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 text-sm",
                          "hover:bg-muted/60 transition-colors disabled:opacity-50",
                        )}
                      >
                        <StickyNote className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{n.title.trim() || n.content.slice(0, 40) || "Bez tytułu"}</span>
                        {n.reminder && (
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            ma już termin
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
      </DialogContent>
    </Dialog>
  );
}
