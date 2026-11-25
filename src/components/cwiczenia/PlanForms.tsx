import { useState } from "react";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EXERCISES, exerciseById } from "@/lib/training/catalog";
import { planLine, TRAINING_REPS_MAX, type PlanDay } from "@/lib/training/model";
import { addPlanDay, removePlanDay, restorePlanDay, useCustomExercises } from "@/lib/training/store";
import { toastWithUndo } from "@/lib/undoToast";
import { AnimatePresence, m as motion } from "framer-motion";
import { listItemMotion } from "@/lib/cardMotion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { parseNum } from "./trainingFormat";

/** C1.2: wydzielone z `TrainingSection.tsx` bez zmian zachowania. */

export function PlanList({ plans }: { plans: PlanDay[] }) {
  const rowMotion = listItemMotion(useMotionPref().reduced);
  if (plans.length === 0) return <p className="text-sm text-muted-foreground">Nie masz jeszcze planu dni. Dodaj go poniżej.</p>;
  return (
    <div className="space-y-2" data-testid="training-plans">
      <h3 className="section-caps">Plan dni</h3>
      <ul className="divide-y divide-border/50">
        <AnimatePresence initial={false}>
        {plans.map((p) => (
          <motion.li key={p.id} {...rowMotion} className="flex items-start gap-3 py-2">
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
              <Trash className="size-4" aria-hidden />
            </Button>
          </motion.li>
        ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export function AddPlanForm() {
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
