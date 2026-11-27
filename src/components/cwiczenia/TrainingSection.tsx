import { EXERCISE_LABEL } from "@/lib/exerciseLabel";
import { useEffect, useMemo, useState } from "react";
import { restRun } from "@/lib/training/restRun";
import { SectionCard } from "@/components/ui/section-card";
import { Dumbbell, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { localDayKey } from "@/lib/dayDone";
import { useRestSeconds } from "@/lib/training/restPrefs";
import { nextReminderAt } from "@/lib/timeOfDay";
import { exerciseById, MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/lib/training/catalog";
import { byTrainingTime, DELOAD_AFTER_WEEKS, missedMajorGroups, trainingStreakWeeks, trainingWeek, progressByExercise, TRAINING_REMINDER_DEFAULT, TRAINING_WINDOW_END, volumeOf, type TrainingEntry, type TrainingReminder } from "@/lib/training/model";
import { removeTrainingEntry, restoreTrainingEntry, setTrainingReminder, useTrainingEntries, useTrainingPlans, useTrainingReminder } from "@/lib/training/store";
import { toastWithUndo } from "@/lib/undoToast";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useWakeLock } from "@/hooks/useWakeLock";
import { EquipmentForm } from "./EquipmentForm";
import { LogForm } from "./LogForm";
import { AddPlanForm, PlanList } from "./PlanForms";
import { ProgressList } from "./ProgressList";
import { RestControl, RestTimer } from "./RestTimer";
import { setsLine } from "./trainingFormat";
import { startOfWeekKey } from "@/lib/week";
import { dismissDeload, useDeloadDismissed } from "@/lib/training/deload";

/** Trening w dziale Ćwiczenia: przypomnienie, plany dni, dziennik serii z przerwą, dziś i progres. */
export function TrainingSection() {
  const entries = useTrainingEntries();
  const plans = useTrainingPlans();
  const today = localDayKey();
  const todays = useMemo(() => entries.filter((e) => e.day === today).sort(byTrainingTime), [entries, today]);
  const progress = useMemo(() => progressByExercise(entries), [entries]);
  const week = useMemo(() => trainingWeek(entries, today, (id) => exerciseById(id)?.group), [entries, today]);
  // C2.5: po 6 pełnych tygodniach z rzędu — podpowiedź „tydzień lżej”, do odrzucenia na ten tydzień.
  const streak = useMemo(() => trainingStreakWeeks(entries, today), [entries, today]);
  const weekStart = startOfWeekKey(today);
  const deloadDismissed = useDeloadDismissed();
  const showDeload = streak >= DELOAD_AFTER_WEEKS && deloadDismissed !== weekStart;
  const [rest, setRestState] = useState<{ until: number; total: number; startedAt: number } | null>(null);
  // C2.6: przerwa widoczna też dla harmonogramu alarmów (koniec przerwy przy zgaszonym ekranie).
  const setRest = (next: { until: number; total: number; startedAt?: number } | null) => {
    const run = next ? { ...next, startedAt: next.startedAt ?? Date.now() } : null;
    setRestState(run);
    restRun.set(run ? { startedAt: run.startedAt, until: run.until } : null);
  };
  useEffect(() => () => restRun.set(null), []);
  const restSeconds = useRestSeconds();
  // Q3.1: w przerwie między seriami telefon leży obok — ekran nie gaśnie, dopóki liczy się przerwa.
  useWakeLock(rest !== null);

  return (
    <SectionCard icon={Dumbbell} title="Trening" bodyClassName="space-y-5">

      <PlanList plans={plans} />
      <LogForm entries={entries} plans={plans} onSaved={() => setRest({ until: Date.now() + restSeconds * 1000, total: restSeconds })} />
      {rest !== null && <RestTimer until={rest.until} total={rest.total} onExtend={() => setRest({ until: rest.until + 30_000, total: rest.total + 30, startedAt: rest.startedAt })} onStop={() => setRest(null)} />}

      {todays.length > 0 && (
        <div>
          <h3 className="section-caps">Dziś</h3>
          <ul className="mt-1 divide-y divide-border/50" data-testid="training-today">
            {todays.map((e) => <EntryRow key={e.id} entry={e} />)}
          </ul>
        </div>
      )}

      <WeekSummary week={week} />
      {showDeload && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-field border border-primary/40 bg-primary/5 px-3 py-2 text-sm" data-testid="deload-hint">
          <span className="min-w-0 flex-1">
            <span className="font-medium">{streak} tygodni treningu z rzędu.</span> Ten tydzień lżej: mniej o ok. 40% serii albo ciężaru — mięśnie i stawy odpoczną, a forma wróci z zapasem.
          </span>
          <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={() => dismissDeload(weekStart)}>Nie teraz</Button>
        </div>
      )}
      <ProgressList progress={progress} entries={entries} />
      <AddPlanForm />
      {/* 2.2: ustawienia rzadko zmieniane są na dole, żeby na górze karty były plan i zapis. */}
      <details className="group border-t border-dashed border-border pt-3" data-testid="training-settings">
        <summary className="pressable cursor-pointer list-none text-sm font-medium text-muted-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11 coarse:py-2">
          <span aria-hidden className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>Ustawienia treningu
        </summary>
        <div className="mt-3 space-y-4">
          <RestControl />
          <TrainingReminderControl />
          <EquipmentForm />
        </div>
      </details>
    </SectionCard>
  );
}

/**
 * 3.5: tydzień treningowy — dni z treningiem i serie na partię (pn–nd), od najczęstszej; brak partii na liście
 * pokazuje, co w tym tygodniu jest pomijane.
 */
function WeekSummary({ week }: { week: ReturnType<typeof trainingWeek> }) {
  if (week.days === 0) return null;
  const missed = missedMajorGroups(week);
  return (
    <div data-testid="training-week">
      <h3 className="section-caps">Ten tydzień</h3>
      <p className="mt-1 text-sm">
        <span className="font-semibold">{week.days} {week.days === 1 ? "trening" : week.days < 5 ? "treningi" : "treningów"}</span>
        {week.setsByGroup.length > 0 && (
          <span className="text-muted-foreground"> · serie: {week.setsByGroup.map((g) => `${MUSCLE_GROUP_LABELS[g.group as MuscleGroup] ?? g.group} ${g.sets}`).join(", ")}</span>
        )}
      </p>
      {missed.length > 0 && (
        <p className="mt-0.5 text-xs text-warning-ink" data-testid="training-week-missed">
          W tym tygodniu bez: {missed.map((g) => MUSCLE_GROUP_LABELS[g as MuscleGroup].toLowerCase()).join(", ")}
        </p>
      )}
    </div>
  );
}

function EntryRow({ entry }: { entry: TrainingEntry }) {
  const name = exerciseById(entry.exerciseId)?.name ?? entry.exerciseId;
  const volume = volumeOf(entry.sets);
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{entry.time ?? "—"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{name}</p>
        <p className="ui-hint">{setsLine(entry.sets)}{volume > 0 && ` · objętość ${volume} kg`}</p>
        {entry.note && <p className="ui-hint">{entry.note}</p>}
      </div>
      <Button variant="ghost" size="sm" className="coarse:h-11" aria-label={`Usuń wpis: ${name}`} onClick={() => deleteEntryWithUndo(entry)}>
        <Trash className="size-4" aria-hidden />
      </Button>
    </li>
  );
}

function deleteEntryWithUndo(entry: TrainingEntry) {
  const prev = removeTrainingEntry(entry.id);
  if (!prev) return;
  toastWithUndo("Usunięto wpis treningu", () => restoreTrainingEntry(prev), { description: exerciseById(prev.exerciseId)?.name });
}

/**
 * Przypomnienie o treningu (domyślnie 18:00, okno do 20:00). Tworzy notatkę z dziennym powtarzaniem
 * w Przypomnieniach; zmiana godziny albo wyłączenie sprząta poprzednią notatkę.
 */
function TrainingReminderControl() {
  const reminder = useTrainingReminder();
  const notes = useNotesContext();
  const [time, setTime] = useState(reminder?.time ?? TRAINING_REMINDER_DEFAULT);
  // L4: godzina nadąża za zmianą z innego urządzenia.
  useEffect(() => { if (reminder?.time) setTime(reminder.time); }, [reminder?.time]);
  // M1/H2: przypomnienie bez swojej notatki (usunięta trwale albo po przywróceniu kopii) jest wyłączone.
  const noteExists = !!reminder?.noteId && [...notes.notes, ...notes.archivedNotes, ...notes.trashedNotes].some((n) => n.id === reminder.noteId);
  const on = reminder !== null && noteExists;
  // M2: pusta albo zepsuta godzina nie tworzy przypomnienia.
  const timeOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  const apply = (next: TrainingReminder | null) => {
    if (next && !/^([01]\d|2[0-3]):[0-5]\d$/.test(next.time)) return;
    if (reminder?.noteId) notes.trashNote(reminder.noteId);
    if (!next) {
      setTrainingReminder(null);
      return;
    }
    const noteId = notes.addNote(
      `Trening — ${next.time}–${TRAINING_WINDOW_END}`,
      `Trening po pracy. Okno: ${next.time}–${TRAINING_WINDOW_END}.`,
      "default",
      [EXERCISE_LABEL],
      nextReminderAt(next.time, Date.now()),
    );
    notes.updateNote(noteId, { reminderRepeat: "daily" });
    setTrainingReminder({ time: next.time, noteId });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-field border border-border/60 px-3 py-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <Checkbox checked={on} disabled={!on && !timeOk} onCheckedChange={(v) => apply(v === true ? { time } : null)} className="coarse:h-6 coarse:w-6" />
        Przypominaj o treningu, codziennie o
      </label>
      <Input
        type="time"
        aria-label="Godzina przypomnienia o treningu"
        value={time}
        disabled={!on}
        onChange={(e) => setTime(e.target.value)}
        // Zapis dopiero po wyjściu z pola (albo Enter): każdy znak osobno przenosił notatkę do kosza.
        onBlur={(e) => {
          const v = e.target.value;
          if (on && /^\d{2}:\d{2}$/.test(v) && v !== reminder?.time) apply({ time: v });
        }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        className="w-auto coarse:h-11"
      />
      <span className="text-xs text-muted-foreground">okno do {TRAINING_WINDOW_END}</span>
    </div>
  );
}
