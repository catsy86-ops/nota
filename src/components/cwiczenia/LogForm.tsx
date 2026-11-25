import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { localDayKey } from "@/lib/dayDone";
import { afterLogged, afterSkipped, currentExerciseId, isFinished, sessionMinutes, startSession, type TrainingSession } from "@/lib/training/session";
import { addDaysToKey } from "@/lib/week";
import { cn } from "@/lib/utils";
import { CUSTOM_HINT_MAX, CUSTOM_NAME_MAX, CUSTOM_PREFIX, EQUIPMENT_LIST, EXERCISES, exerciseById, MUSCLE_GROUP_LABELS, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from "@/lib/training/catalog";
import { bestKg, byTrainingTime, overDumbbell, planLine, TRAINING_NOTE_MAX, TRAINING_REPS_MAX, TRAINING_SECONDS_MAX, volumeOf, type PlanDay, type TrainingEntry, type TrainingSet } from "@/lib/training/model";
import { addTrainingEntry, useTrainingEquipment, useCustomExercises, addCustomExercise, removeCustomExercise } from "@/lib/training/store";
import { toastWithUndo } from "@/lib/undoToast";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { useWakeLock } from "@/hooks/useWakeLock";
import { progressionText, suggestNext, targetRepsFor } from "@/lib/training/progression";
import { emptyRow, nowHHMM, parseKg, parseNum, setsLine, shortDay, type SetRow } from "./trainingFormat";

/** C1.2: wydzielone z `TrainingSection.tsx` bez zmian zachowania. */

/** Nowe własne ćwiczenie: nazwa, partia, sprzęt i wskazówka. Po zapisie ćwiczenie zostaje wybrane. */
function NewExerciseForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState<MuscleGroup>("klatka");
  const [equipment, setEquipment] = useState<Equipment[]>(["hantle"]);
  const [hint, setHint] = useState("");
  const valid = name.trim().length > 0 && equipment.length > 0;

  const save = () => {
    if (!valid) return;
    const e = addCustomExercise({ name: name.trim(), group, equipment, hint: hint.trim() });
    if (!e) { toast.error("Nie udało się dodać ćwiczenia", { description: "Lista własnych ćwiczeń jest pełna." }); return; }
    haptic("tap");
    onCreated(e.id);
  };

  return (
    // Nie <form>: ten blok siedzi wewnątrz formularza wpisu treningu, a zagnieżdżony form przejmuje wysłanie i przeładowuje stronę.
    <div role="group" className="space-y-2 rounded-card border border-border/60 p-3" aria-label="Nowe ćwiczenie">
      <Input aria-label="Nazwa ćwiczenia" placeholder="np. Pompki na poręczach" maxLength={CUSTOM_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Partia mięśniowa" value={group} onChange={(e) => setGroup(e.target.value as MuscleGroup)} className="rounded-control border border-input bg-background px-3 py-2 text-sm coarse:h-11">
          {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{MUSCLE_GROUP_LABELS[g]}</option>)}
        </select>
        {(EQUIPMENT_OPTIONS).map((eq) => (
          <label key={eq} className="flex items-center gap-1.5 text-sm">
            <Checkbox checked={equipment.includes(eq)} onCheckedChange={(v) => setEquipment(v === true ? [...equipment, eq] : equipment.filter((x) => x !== eq))} />
            {eq}
          </label>
        ))}
      </div>
      <Input aria-label="Wskazówka (nieobowiązkowa)" placeholder="np. łokcie blisko ciała" maxLength={CUSTOM_HINT_MAX} value={hint} onChange={(e) => setHint(e.target.value)} />
      <Button type="button" size="sm" disabled={!valid} className="coarse:h-11" onClick={save}>Dodaj ćwiczenie</Button>
    </div>
  );
}

const EQUIPMENT_OPTIONS: Equipment[] = EQUIPMENT_LIST;

/** 2.1: pasek prowadzonego treningu: „Klatka i triceps · 2/4” z pominięciem, a na końcu podsumowanie. */
function SessionBanner({ session, onSkip, onClose }: { session: TrainingSession; onSkip: () => void; onClose: () => void }) {
  const total = session.exerciseIds.length;
  if (isFinished(session)) {
    return (
      <div role="status" className="space-y-1 rounded-field border border-primary/40 bg-primary/5 px-3 py-2 text-sm" data-testid="session-summary">
        <p className="font-medium">Zrobione: {session.planName}</p>
        <p className="ui-hint">
          {session.logged} z {total} ćwiczeń · objętość {Math.round(session.volume)} kg · {sessionMinutes(session, Date.now())} min
          {session.records > 0 && ` · rekordów: ${session.records}`}
        </p>
        <Button type="button" variant="outline" size="sm" className="coarse:h-11" onClick={onClose}>Zamknij</Button>
      </div>
    );
  }
  const name = exerciseById(currentExerciseId(session) ?? "")?.name ?? "ćwiczenie";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-field border border-primary/40 px-3 py-2 text-sm" data-testid="session-banner">
      <span className="min-w-0 flex-1"><span className="font-medium">{session.planName}</span> · ćwiczenie <span className="font-mono tabular-nums">{session.index + 1}/{total}</span>: {name}</span>
      <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={onSkip}>Pomiń ćwiczenie</Button>
      <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={onClose}>Zakończ plan</Button>
    </div>
  );
}

export function LogForm({ entries, plans, onSaved }: { entries: TrainingEntry[]; plans: PlanDay[]; onSaved: () => void }) {
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const [rows, setRows] = useState<SetRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [note, setNote] = useState("");
  /** Dzień zapisu: dziś albo wczoraj (zapomniany trening). */
  const [forYesterday, setForYesterday] = useState(false);
  const custom = useCustomExercises();
  const all = useMemo(() => [...EXERCISES, ...custom], [custom]);
  const [newOpen, setNewOpen] = useState(false);
  /** 2.1: prowadzony trening — wybór dnia planu go rozpoczyna. */
  const [session, setSession] = useState<TrainingSession | null>(null);
  // Q3.1: prowadzony trening — ekran nie gaśnie do końca planu.
  useWakeLock(session !== null && !isFinished(session));
  /** 2.7: serie liczone w sekundach (deska, zwis) zamiast powtórzeń; domyślnie wg ćwiczenia, do zmiany przełącznikiem. */
  const [timed, setTimed] = useState(() => !!exerciseById(EXERCISES[0].id)?.timed);
  useEffect(() => { setTimed(!!exerciseById(exerciseId)?.timed); }, [exerciseId]);

  const rowsFor = (sess: TrainingSession): SetRow[] => Array.from({ length: sess.targetSets }, () => ({ reps: String(sess.targetReps), kg: "" }));
  /** Ustawia formularz na bieżące ćwiczenie sesji (albo zostawia, gdy plan skończony). */
  const showCurrent = (sess: TrainingSession) => {
    const id = currentExerciseId(sess);
    if (id === undefined) return;
    setExerciseId(id);
    setRows(rowsFor(sess));
    setNote("");
  };

  /** Usuwa własne ćwiczenie bez wpisów i planów; z wpisami zostaje, a komunikat mówi dlaczego. */
  const deleteCustom = (id: string) => {
    const snap = exerciseById(id);
    if (!removeCustomExercise(id)) { toast.error("Ćwiczenia z wpisami albo w planie nie da się usunąć"); return; }
    setExerciseId(EXERCISES[0].id);
    // Ćwiczenie bez wpisów nie ma odwołań, więc „Cofnij” dodaje je ponownie (nowe id, te same dane).
    if (snap) toastWithUndo("Usunięto własne ćwiczenie", () => { addCustomExercise({ name: snap.name, group: snap.group, equipment: snap.equipment, hint: snap.hint }); }, { icon: "🗑️" });
    else toast.success("Usunięto własne ćwiczenie");
  };

  /** Wybór dnia planu: ustawia pierwsze ćwiczenie dnia i tyle serii, ile zaplanowano. */
  const pickPlan = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    const sess = startSession(plan, Date.now());
    setSession(sess);
    if (sess) showCurrent(sess);
  };

  const last = useMemo(() => {
    const own = entries.filter((e) => e.exerciseId === exerciseId).sort(byTrainingTime);
    return own[own.length - 1];
  }, [entries, exerciseId]);

  const parsed = rows.map((r) => ({ reps: parseNum(r.reps, timed ? TRAINING_SECONDS_MAX : TRAINING_REPS_MAX, true), kg: parseKg(r.kg) }));
  const badKg = rows.some((r, i) => parsed[i].kg === null && r.kg.trim() !== "");
  const filled = parsed.filter((p) => p.reps !== undefined);
  const invalid = parsed.some((p) => p.reps === null || p.kg === null || (p.reps === undefined && p.kg !== undefined));
  const valid = !invalid && filled.length > 0 && note.length <= TRAINING_NOTE_MAX;
  const equipment = useTrainingEquipment();
  const exercise = exerciseById(exerciseId);
  // Ostrzeżenie, nie blokada: ciężar ponad hantle z ustawienia da się zapisać (np. po zmianie hantli).
  const overLimit = parsed.some((p) => p.kg !== undefined && p.kg !== null && overDumbbell(p.kg, exercise?.equipment ?? [], equipment));
  // C2.1: podpowiedź podwójnej progresji z ostatniej sesji; cel powtórek z sesji albo z planu z tym ćwiczeniem.
  const sessionTarget = session && !isFinished(session) && exerciseId === currentExerciseId(session) ? session.targetReps : undefined;
  const hint = useMemo(
    () => (timed ? null : suggestNext(entries, exerciseId, targetRepsFor(exerciseId, plans, sessionTarget), exercise?.equipment ?? [], equipment)),
    [timed, entries, exerciseId, plans, sessionTarget, exercise?.equipment, equipment],
  );

  const save = () => {
    if (!valid) return;
    const sets: TrainingSet[] = filled.map((p) => ({ ...(timed ? { reps: 1, seconds: p.reps as number } : { reps: p.reps as number }), ...(p.kg !== undefined && p.kg !== null ? { kg: p.kg } : {}) }));
    // 3.3: nowy rekord — cięższa seria niż dotychczasowy najcięższy ciężar tego ćwiczenia (pierwszy zapis
    // rekordem nie jest, bo nie ma czego pobić).
    const prevBest = entries.filter((e) => e.exerciseId === exerciseId).reduce<number | undefined>((best, e) => {
      const b = bestKg(e.sets);
      return b !== undefined && (best === undefined || b > best) ? b : best;
    }, undefined);
    const newBest = bestKg(sets);
    // Wczoraj: bez godziny — teraźniejsza godzina nic by nie znaczyła.
    if (!addTrainingEntry(forYesterday ? { exerciseId, sets, note, day: addDaysToKey(localDayKey(), -1) } : { exerciseId, sets, note, time: nowHHMM() })) return;
    if (forYesterday) toast.success("Zapisano trening do wczoraj");
    setForYesterday(false);
    if (newBest !== undefined && prevBest !== undefined && newBest > prevBest) {
      haptic("success");
      toast.success(`Nowy rekord: ${exerciseById(exerciseId)?.name ?? "ćwiczenie"} — ${newBest} kg`);
    }
    const record = newBest !== undefined && prevBest !== undefined && newBest > prevBest;
    if (session && !isFinished(session) && exerciseId === currentExerciseId(session)) {
      const next = afterLogged(session, volumeOf(sets), record);
      setSession(next);
      if (isFinished(next)) { setRows([emptyRow(), emptyRow(), emptyRow()]); setNote(""); } else showCurrent(next);
      // Przerwa tylko wtedy, gdy jest jeszcze ćwiczenie do zrobienia.
      if (!isFinished(next)) onSaved();
      return;
    }
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    setNote("");
    onSaved();
  };

  const skip = () => {
    if (!session) return;
    const next = afterSkipped(session);
    setSession(next);
    if (!isFinished(next)) showCurrent(next);
  };

  return (
    <form className="space-y-3 border-t border-dashed border-border pt-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <p className="ui-hint font-medium">Zapisz trening</p>
      {plans.length > 0 && (
        <label className="block text-sm">
          <span className="sr-only">Dzień planu</span>
          <select
            defaultValue=""
            onChange={(e) => pickPlan(e.target.value)}
            className="w-full rounded-control border border-input bg-background px-3 py-2 text-sm coarse:h-11"
          >
            <option value="" disabled>Wybierz dzień planu (opcjonalnie)</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{planLine(p)}</option>)}
          </select>
        </label>
      )}
      {session && <SessionBanner session={session} onSkip={skip} onClose={() => setSession(null)} />}
      <label className="block text-sm">
        <span className="sr-only">Ćwiczenie</span>
        <select
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          className="w-full rounded-control border border-input bg-background px-3 py-2 text-sm coarse:h-11"
        >
          {MUSCLE_GROUPS.map((g: MuscleGroup) => (
            <optgroup key={g} label={g[0].toUpperCase() + g.slice(1)}>
              {all.filter((e) => e.group === g).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <p className="ui-hint">{exerciseById(exerciseId)?.hint}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button type="button" variant="ghost" size="sm" className="coarse:h-11" aria-expanded={newOpen} onClick={() => setNewOpen((v) => !v)}>{newOpen ? "Zamknij" : "+ Nowe ćwiczenie"}</Button>
        {exerciseId.startsWith(CUSTOM_PREFIX) && (
          <Button type="button" variant="ghost" size="sm" className="coarse:h-11 text-destructive-ink" onClick={() => deleteCustom(exerciseId)}>Usuń to ćwiczenie</Button>
        )}
      </div>
      {newOpen && <NewExerciseForm onCreated={(id) => { setExerciseId(id); setNewOpen(false); }} />}
      {last ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Ostatnio ({shortDay(last.day)}): {setsLine(last.sets)}</span>
          <Button type="button" variant="outline" size="sm" className="coarse:h-11" onClick={() => { setTimed(last.sets.some((s) => s.seconds !== undefined)); setRows(last.sets.map((s) => ({ reps: String(s.seconds ?? s.reps), kg: s.kg !== undefined ? String(s.kg) : "" }))); }}>
            Użyj ostatnich
          </Button>
        </div>
      ) : null}
      {!last && <p className="ui-hint">To pierwszy zapis tego ćwiczenia.</p>}
      {last && hint ? (
        <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="progression-hint">
          <span className="font-medium text-primary-ink">{progressionText(hint)}</span>
          <Button type="button" variant="outline" size="sm" className="coarse:h-11" onClick={() => setRows(last.sets.map(() => ({ reps: String(hint.reps), kg: String(hint.kg).replace(".", ",") })))}>
            Wpisz
          </Button>
        </div>
      ) : null}

      <div role="radiogroup" aria-label="Rodzaj serii" className="flex gap-1.5">
        {([false, true] as const).map((t) => (
          <button key={String(t)} type="button" role="radio" aria-checked={timed === t} onClick={() => setTimed(t)}
            className={cn("pressable rounded-full border px-3 py-1 text-xs outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11",
              timed === t ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground")}>
            {t ? "Na czas" : "Powtórzenia"}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
            <span className="w-14 text-xs text-muted-foreground">Seria {i + 1}</span>
            <Input inputMode="numeric" aria-label={`${timed ? "Sekundy" : "Powtórki"}, seria ${i + 1}`} aria-invalid={parsed[i].reps === null} placeholder={timed ? "sek." : "powt."} value={r.reps} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))} />
            <Input inputMode="decimal" aria-label={`Ciężar kg, seria ${i + 1}`} aria-invalid={parsed[i].kg === null} placeholder={timed ? "kg dodatkowo" : "kg"} value={r.kg} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kg: e.target.value } : x)))} />
          </div>
        ))}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="coarse:h-11" disabled={rows.length >= 30} onClick={() => setRows([...rows, emptyRow()])}>Dodaj serię</Button>
          {rows.length > 1 && <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={() => setRows(rows.slice(0, -1))}>Usuń ostatnią</Button>}
        </div>
      </div>

      {overLimit && (
        <p role="status" className="text-xs text-destructive-ink">
          Ciężar powyżej Twoich hantli ({equipment.dumbbellMaxKg} kg) — sprawdź wpis albo zmień ustawienie sprzętu.
        </p>
      )}
      <div role="group" aria-label="Dzień treningu" className="flex gap-1.5">
        {([false, true] as const).map((y) => (
          <button key={String(y)} type="button" aria-pressed={forYesterday === y} onClick={() => setForYesterday(y)}
            className={cn("pressable rounded-full border px-3 py-1 text-xs outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11",
              forYesterday === y ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground")}>
            {y ? "Wczoraj" : "Dziś"}
          </button>
        ))}
      </div>
      <Input aria-label="Uwagi do treningu" placeholder="Uwagi (opcjonalnie)" maxLength={TRAINING_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
      {badKg && <p role="alert" className="w-full text-xs text-destructive-ink">Ciężar wpisz co pół kilo, np. 22 albo 22,5.</p>}
      <Button type="submit" size="sm" disabled={!valid} className="coarse:h-11">Zapisz serie</Button>
    </form>
  );
}
