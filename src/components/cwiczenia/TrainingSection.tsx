import { EXERCISE_LABEL } from "@/lib/exerciseLabel";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
import { Dumbbell, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { localDayKey } from "@/lib/dayDone";
import { REST_OPTIONS, restLabel, setRestSeconds, useRestSeconds } from "@/lib/training/restPrefs";
import { addDaysToKey } from "@/lib/week";
import { cn } from "@/lib/utils";
import { nextReminderAt } from "@/lib/timeOfDay";
import { CUSTOM_HINT_MAX, CUSTOM_NAME_MAX, CUSTOM_PREFIX, EQUIPMENT_LIST, EXERCISES, exerciseById, MUSCLE_GROUP_LABELS, MUSCLE_GROUPS, type Equipment, type MuscleGroup } from "@/lib/training/catalog";
import { bestKg, bestKgSeries, byTrainingTime, trainingWeek, overDumbbell, planLine, progressByExercise, TRAINING_KG_MAX, TRAINING_NOTE_MAX, TRAINING_REMINDER_DEFAULT, TRAINING_REPS_MAX, TRAINING_WINDOW_END, volumeOf, type PlanDay, type TrainingEntry, type TrainingReminder, type TrainingSet } from "@/lib/training/model";
import { addPlanDay, addTrainingEntry, removePlanDay, removeTrainingEntry, restorePlanDay, restoreTrainingEntry, setTrainingEquipment, setTrainingReminder, useTrainingEntries, useTrainingEquipment, useTrainingPlans, useTrainingReminder, useCustomExercises, addCustomExercise, removeCustomExercise } from "@/lib/training/store";
import { toastWithUndo } from "@/lib/undoToast";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { useNotesContext } from "@/hooks/NotesProvider";

/** Trening w dziale Ćwiczenia: przypomnienie, plany dni, dziennik serii z przerwą, dziś i progres. */
export function TrainingSection() {
  const entries = useTrainingEntries();
  const plans = useTrainingPlans();
  const today = localDayKey();
  const todays = useMemo(() => entries.filter((e) => e.day === today).sort(byTrainingTime), [entries, today]);
  const progress = useMemo(() => progressByExercise(entries), [entries]);
  const week = useMemo(() => trainingWeek(entries, today, (id) => exerciseById(id)?.group), [entries, today]);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const restSeconds = useRestSeconds();

  return (
    <SectionCard icon={Dumbbell} title="Trening" bodyClassName="space-y-5">

      <PlanList plans={plans} />
      <LogForm entries={entries} plans={plans} onSaved={() => setRest({ until: Date.now() + restSeconds * 1000, total: restSeconds })} />
      {rest !== null && <RestTimer until={rest.until} total={rest.total} onExtend={() => setRest({ until: rest.until + 30_000, total: rest.total + 30 })} onStop={() => setRest(null)} />}

      {todays.length > 0 && (
        <div>
          <h3 className="section-caps">Dziś</h3>
          <ul className="mt-1 divide-y divide-border/50" data-testid="training-today">
            {todays.map((e) => <EntryRow key={e.id} entry={e} />)}
          </ul>
        </div>
      )}

      <WeekSummary week={week} />
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
  return (
    <div data-testid="training-week">
      <h3 className="section-caps">Ten tydzień</h3>
      <p className="mt-1 text-sm">
        <span className="font-semibold">{week.days} {week.days === 1 ? "trening" : week.days < 5 ? "treningi" : "treningów"}</span>
        {week.setsByGroup.length > 0 && (
          <span className="text-muted-foreground"> · serie: {week.setsByGroup.map((g) => `${MUSCLE_GROUP_LABELS[g.group as MuscleGroup] ?? g.group} ${g.sets}`).join(", ")}</span>
        )}
      </p>
    </div>
  );
}

function setsLine(sets: TrainingSet[]): string {
  return sets.map((s) => (s.kg !== undefined ? `${s.reps}×${s.kg} kg` : `${s.reps}`)).join(", ");
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
        <Trash className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  );
}

function deleteEntryWithUndo(entry: TrainingEntry) {
  const prev = removeTrainingEntry(entry.id);
  if (!prev) return;
  toastWithUndo("Usunięto wpis treningu", () => restoreTrainingEntry(prev), { description: exerciseById(prev.exerciseId)?.name });
}

function PlanList({ plans }: { plans: PlanDay[] }) {
  if (plans.length === 0) return <p className="text-sm text-muted-foreground">Nie masz jeszcze planu dni. Dodaj go poniżej.</p>;
  return (
    <div className="space-y-2" data-testid="training-plans">
      <h3 className="section-caps">Plan dni</h3>
      <ul className="divide-y divide-border/50">
        {plans.map((p) => (
          <li key={p.id} className="flex items-start gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{planLine(p)}</p>
              <p className="ui-hint">{p.exerciseIds.map((id) => exerciseById(id)?.name ?? id).join(" · ")}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="coarse:h-11"
              aria-label={`Usuń dzień: ${p.name}`}
              onClick={() => {
                const prev = removePlanDay(p.id);
                if (prev) toastWithUndo("Usunięto dzień planu", () => restorePlanDay(prev), { description: prev.name });
              }}
            >
              <Trash className="h-4 w-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface SetRow { reps: string; kg: string }

const emptyRow = (): SetRow => ({ reps: "", kg: "" });

/** Liczba z pola; pusta = brak, poza zakresem lub nie-liczba = `null`. */
function parseNum(text: string, max: number, integer: boolean): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  if (integer && !Number.isInteger(n)) return null;
  return n;
}

/** Ciężar: co pół kilo (jak zapisuje model). Wpis 22,3 odrzucamy z podpowiedzią, zamiast zapisać 22,5 po cichu. */
function parseKg(text: string): number | undefined | null {
  const n = parseNum(text, TRAINING_KG_MAX, false);
  if (n === undefined || n === null) return n;
  return Number.isInteger(n * 2) ? n : null;
}

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

function LogForm({ entries, plans, onSaved }: { entries: TrainingEntry[]; plans: PlanDay[]; onSaved: () => void }) {
  const [exerciseId, setExerciseId] = useState(EXERCISES[0].id);
  const [rows, setRows] = useState<SetRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [note, setNote] = useState("");
  /** Dzień zapisu: dziś albo wczoraj (zapomniany trening). */
  const [forYesterday, setForYesterday] = useState(false);
  const custom = useCustomExercises();
  const all = useMemo(() => [...EXERCISES, ...custom], [custom]);
  const [newOpen, setNewOpen] = useState(false);

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
    setExerciseId(plan.exerciseIds[0]);
    setRows(Array.from({ length: plan.targetSets }, () => ({ reps: String(plan.targetReps), kg: "" })));
  };

  const last = useMemo(() => {
    const own = entries.filter((e) => e.exerciseId === exerciseId).sort(byTrainingTime);
    return own[own.length - 1];
  }, [entries, exerciseId]);

  const parsed = rows.map((r) => ({ reps: parseNum(r.reps, TRAINING_REPS_MAX, true), kg: parseKg(r.kg) }));
  const badKg = rows.some((r, i) => parsed[i].kg === null && r.kg.trim() !== "");
  const filled = parsed.filter((p) => p.reps !== undefined);
  const invalid = parsed.some((p) => p.reps === null || p.kg === null || (p.reps === undefined && p.kg !== undefined));
  const valid = !invalid && filled.length > 0 && note.length <= TRAINING_NOTE_MAX;
  const equipment = useTrainingEquipment();
  const exercise = exerciseById(exerciseId);
  // Ostrzeżenie, nie blokada: ciężar ponad hantle z ustawienia da się zapisać (np. po zmianie hantli).
  const overLimit = parsed.some((p) => p.kg !== undefined && p.kg !== null && overDumbbell(p.kg, exercise?.equipment ?? [], equipment));

  const save = () => {
    if (!valid) return;
    const sets: TrainingSet[] = filled.map((p) => ({ reps: p.reps as number, ...(p.kg !== undefined && p.kg !== null ? { kg: p.kg } : {}) }));
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
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    setNote("");
    onSaved();
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
          <Button type="button" variant="outline" size="sm" className="coarse:h-11" onClick={() => setRows(last.sets.map((s) => ({ reps: String(s.reps), kg: s.kg !== undefined ? String(s.kg) : "" })))}>
            Użyj ostatnich
          </Button>
        </div>
      ) : (
        <p className="ui-hint">To pierwszy zapis tego ćwiczenia.</p>
      )}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
            <span className="w-14 text-xs text-muted-foreground">Seria {i + 1}</span>
            <Input inputMode="numeric" aria-label={`Powtórki, seria ${i + 1}`} aria-invalid={parsed[i].reps === null} placeholder="powt." value={r.reps} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))} />
            <Input inputMode="decimal" aria-label={`Ciężar kg, seria ${i + 1}`} aria-invalid={parsed[i].kg === null} placeholder="kg" value={r.kg} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kg: e.target.value } : x)))} />
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

function ProgressList({ progress, entries }: { progress: ReturnType<typeof progressByExercise>; entries: TrainingEntry[] }) {
  const rows = [...progress.values()];
  if (rows.length === 0) return null;
  return (
    <div className="border-t border-dashed border-border pt-4">
      <h3 className="section-caps">Progres</h3>
      <ul className="mt-2 space-y-2 text-sm" data-testid="training-progress">
        {rows.map((p) => {
          const series = bestKgSeries(entries, p.exerciseId);
          return (
            <li key={p.exerciseId}>
              <div className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{exerciseById(p.exerciseId)?.name ?? p.exerciseId}</span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {p.bestKg !== undefined ? `rekord ${p.bestKg} kg (${shortDay(p.bestDay ?? "")})` : "bez ciężaru"} · {p.sessions}×
                </span>
              </div>
              {series.length >= 2 && <Sparkline values={series} label={`Rekordy kolejnych sesji: ${series.join(", ")} kg`} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Wykres kreskowy rekordów (SVG, bez biblioteki). Czytnik dostaje listę wartości w etykiecie. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 160;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} className="mt-1 h-7 w-40 text-primary-ink" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Największy ciężar hantli w domu — używany w ostrzeżeniu przy zapisie serii. */
function EquipmentForm() {
  const equipment = useTrainingEquipment();
  const [kg, setKg] = useState(equipment.dumbbellMaxKg !== undefined ? String(equipment.dumbbellMaxKg) : "");
  // L4: pole nadąża za zmianą z innego urządzenia (nie tylko za pierwszym renderem).
  useEffect(() => {
    setKg(equipment.dumbbellMaxKg !== undefined ? String(equipment.dumbbellMaxKg) : "");
  }, [equipment.dumbbellMaxKg]);
  const value = parseKg(kg);
  return (
    <form
      className="flex flex-wrap items-center gap-3 rounded-field border border-border/60 px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        // L3: pusty formularz nie kasuje limitu po cichu — do tego służy osobny przycisk „Usuń limit”.
        if (value === null || value === undefined || value <= 0) return;
        setTrainingEquipment({ dumbbellMaxKg: value });
      }}
    >
      <label className="text-sm">
        Największy ciężar hantli (kg)
        <Input
          inputMode="decimal"
          aria-invalid={value === null}
          value={kg}
          placeholder="np. 24"
          onChange={(e) => setKg(e.target.value)}
          className="ml-2 inline-block w-24 coarse:h-11"
        />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={value === null || value === undefined || value <= 0} className="coarse:h-11">Zapisz sprzęt</Button>
      {equipment.dumbbellMaxKg !== undefined && (
        <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={() => setTrainingEquipment({})}>Usuń limit</Button>
      )}
    </form>
  );
}

function AddPlanForm() {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [targetSets, setTargetSets] = useState("3");
  const [targetReps, setTargetReps] = useState("10");
  const custom = useCustomExercises();
  const sets = parseNum(targetSets, 10, true);
  const reps = parseNum(targetReps, TRAINING_REPS_MAX, true);
  const valid = name.trim().length > 0 && picked.length > 0 && sets !== null && sets !== undefined && reps !== null && reps !== undefined;

  const save = () => {
    if (!valid) return;
    if (!addPlanDay({ name, exerciseIds: picked, targetSets: sets as number, targetReps: reps as number })) return;
    setName("");
    setPicked([]);
  };

  return (
    <form className="space-y-3 border-t border-dashed border-border pt-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <p className="ui-hint font-medium">Dodaj dzień planu</p>
      <Input aria-label="Nazwa dnia planu" placeholder="np. Klatka i triceps" value={name} onChange={(e) => setName(e.target.value)} />
      <fieldset className="space-y-1">
        <legend className="sr-only">Ćwiczenia w dniu</legend>
        {[...EXERCISES, ...custom].map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={picked.includes(e.id)}
              onCheckedChange={(v) => setPicked(v === true ? [...picked, e.id].slice(0, 12) : picked.filter((x) => x !== e.id))}
              className="coarse:h-6 coarse:w-6"
            />
            {e.name}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <Input inputMode="numeric" aria-label="Cel: serie" aria-invalid={sets === null} value={targetSets} onChange={(e) => setTargetSets(e.target.value)} />
        <Input inputMode="numeric" aria-label="Cel: powtórki" aria-invalid={reps === null} value={targetReps} onChange={(e) => setTargetReps(e.target.value)} />
      </div>
      <Button type="submit" size="sm" disabled={!valid} className="coarse:h-11">Dodaj dzień planu</Button>
    </form>
  );
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

/** Licznik przerwy po zapisie serii; sam się kończy, „Pomiń” kończy wcześniej. */
/** 4.4: przerwa jako pierścień (SVG) z dużym licznikiem, „+30 s” i „Pomiń”. Przy redukcji ruchu pierścień skacze co pół sekundy. */
function RestTimer({ until, total, onExtend, onStop }: { until: number; total: number; onExtend: () => void; onStop: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (left !== 0) return;
    // Koniec przerwy: wibracja (jeśli telefon ją ma i jest włączona), potem zamknięcie licznika.
    haptic("success");
    onStop();
  }, [left, onStop]);

  const R = 34;
  const C = 2 * Math.PI * R;
  const fraction = Math.min(1, Math.max(0, (until - now) / 1000 / total));

  return (
    <div className="flex items-center gap-4 rounded-card border border-primary/40 px-3 py-2" data-testid="rest-timer">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" strokeWidth="6" className="stroke-border" />
          <circle cx="40" cy="40" r={R} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-linear motion-reduce:transition-none"
            strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} />
        </svg>
        {/* Licznik co sekundę tylko dla oka; czytnik ogłasza wyłącznie koniec przerwy. */}
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xl font-semibold tabular-nums" aria-hidden>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Przerwa</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-11" onClick={onExtend}>+30 s</Button>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={onStop}>Pomiń</Button>
        </div>
      </div>
      <span role="status" className="sr-only">{left <= 0 ? "Przerwa skończona" : ""}</span>
    </div>
  );
}

/** 1.2: długość przerwy po zapisie serii. */
function RestControl() {
  const rest = useRestSeconds();
  return (
    <div className="space-y-1.5" data-testid="rest-control">
      <p className="text-sm font-medium">Przerwa po zapisie serii</p>
      <div role="radiogroup" aria-label="Czas przerwy" className="flex flex-wrap gap-2">
        {REST_OPTIONS.map((s) => (
          <Button key={s} type="button" role="radio" aria-checked={rest === s} variant={rest === s ? "default" : "outline"} size="sm" className="coarse:h-11" onClick={() => setRestSeconds(s)}>
            {restLabel(s)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function shortDay(key: string): string {
  const [, m, d] = key.split("-");
  return d && m ? `${d}.${m}` : key;
}
