import { useState } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import { SnoozeUntilDialog } from "@/components/SnoozeUntilDialog";
import type { Note } from "@/hooks/useNotes";
import { haptic } from "@/lib/haptics";
import { toastWithUndo } from "@/lib/undoToast";
import { doneReminderUpdate, reminderFields, endSeriesUpdate, snoozeMenuAt, snoozeReminderUpdate, snoozeToUpdate, type ReminderFields, type SnoozeKind } from "@/lib/reminderActions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Po odhaczeniu albo odłożeniu wiersz znika z listy, więc fokus nie może wrócić na początek strony.
 * Zwraca funkcję wywoływaną po zapisie: sąsiedni kafel w tej samej grupe, a gdy go nie ma — nagłówek sekcji.
 */
function focusAfterRemoval(el: HTMLElement): () => void {
  const wrap = el.closest<HTMLElement>("[data-note-id-wrap]");
  const neighbour = (wrap?.nextElementSibling ?? wrap?.previousElementSibling) as HTMLElement | null | undefined;
  const heading = el.closest("section")?.querySelector<HTMLElement>("h2") ?? null;
  return () => requestAnimationFrame(() => {
    const target = neighbour?.isConnected ? neighbour.querySelector<HTMLElement>("button") : null;
    if (target) { target.focus(); return; }
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  });
}

interface ReminderQuickActionsProps {
  note: Note;
  onUpdate: (id: string, patch: Partial<ReminderFields>) => void;
  /** Dodatkowe klasy układu, np. odstęp nad przyciskami. */
  className?: string;
}

/**
 * „Gotowe”, „Jutro rano”, „+1 h” przy terminie. Ta sama logika na kaflu, w Dziś i w Kalendarzu
 * (`lib/reminderActions.ts`), z cofnięciem w toaście.
 */
export function ReminderQuickActions({ note, onUpdate, className }: ReminderQuickActionsProps) {
  const id = note.id;
  const [untilOpen, setUntilOpen] = useState(false);

  return (
    <div className={cn("flex flex-wrap items-center gap-1 sm:gap-1.5", className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          const prev = reminderFields(note);
          const focus = focusAfterRemoval(e.currentTarget);
          const { patch, message } = doneReminderUpdate(note, Date.now());
          haptic("success");
          onUpdate(id, patch);
          toastWithUndo(message, () => onUpdate(id, prev), { id: `rem-done-${id}` });
          focus();
        }}
        className="pressable inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 sm:px-2.5 py-1 coarse:min-h-11 text-2xs font-medium text-primary-ink hover:bg-primary/20"
      >
        <Check className="w-3 h-3" aria-hidden /> Gotowe
      </button>
      <button
        type="button"
        onClick={() => {
          const prev = reminderFields(note);
          haptic("tap");
          const { patch, message } = snoozeReminderUpdate(note, "tomorrow9", Date.now());
          onUpdate(id, patch);
          toastWithUndo(message, () => onUpdate(id, prev), { id: `rem-snooze-${id}` });
        }}
        className="pressable inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 sm:px-2.5 py-1 coarse:min-h-11 text-2xs font-medium text-muted-foreground hover:text-foreground"
        aria-label="Jutro rano"
      >
        {/* Na telefonie samo „Jutro” — z „rano” oba przyciski nie mieściły się w wąskim kaflu i szły w pion. */}
        Jutro<span className="max-sm:hidden">rano</span>
      </button>
      <button
        type="button"
        onClick={() => {
          const prev = reminderFields(note);
          haptic("tap");
          const { patch, message } = snoozeReminderUpdate(note, "inHour", Date.now());
          onUpdate(id, patch);
          toastWithUndo(message, () => onUpdate(id, prev), { id: `rem-snooze-${id}` });
        }}
        className="pressable inline-flex items-center rounded-full bg-foreground/5 px-2 sm:px-2.5 py-1 coarse:min-h-11 text-2xs font-medium text-muted-foreground hover:text-foreground"
        aria-label="Za godzinę"
      >
        +1 h
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Więcej sposobów odłożenia"
            className="pressable inline-flex items-center rounded-full bg-foreground/5 px-2 sm:px-2.5 py-1 coarse:min-h-11 text-2xs font-medium text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="w-3 h-3" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {snoozeMenuAt(Date.now()).map((o) => (
            <DropdownMenuItem
              key={o.kind}
              onSelect={() => {
                const prev = reminderFields(note);
                haptic("tap");
                const { patch, message } = snoozeReminderUpdate(note, o.kind as SnoozeKind, Date.now());
                onUpdate(id, patch);
                toastWithUndo(message, () => onUpdate(id, prev), { id: `rem-snooze-${id}` });
              }}
            >
              {o.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => setUntilOpen(true)}>Odłóż do…</DropdownMenuItem>
          {endSeriesUpdate(note) && (
            <DropdownMenuItem
              onSelect={() => {
                const prev = reminderFields(note);
                const { patch, message } = endSeriesUpdate(note)!;
                haptic("tap");
                onUpdate(id, patch);
                toastWithUndo(message, () => onUpdate(id, prev), { id: `rem-end-${id}` });
              }}
            >
              Zakończ serię
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <SnoozeUntilDialog open={untilOpen} onOpenChange={setUntilOpen} onPick={(at) => {
        const prev = reminderFields(note);
        const { patch, message } = snoozeToUpdate(note, at, Date.now());
        haptic("tap");
        onUpdate(id, patch);
        toastWithUndo(message, () => onUpdate(id, prev), { id: `rem-snooze-${id}` });
      }} />
    </div>
  );
}
