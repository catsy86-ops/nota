import { useState } from "react";
import { exerciseById } from "@/lib/training/catalog";
import { bestKgSeries, estimateOneRepMax, byTrainingTime, progressByExercise, volumeOf, type TrainingEntry } from "@/lib/training/model";
import { setsLine, shortDay } from "./trainingFormat";

/** C1.2: wydzielone z `TrainingSection.tsx` bez zmian zachowania. */

/** 3.4: sesje jednego ćwiczenia od najnowszej: dzień, serie, objętość i szacowany 1RM (Epley) jako informacja. */
function ExerciseHistory({ entries }: { entries: TrainingEntry[] }) {
  const sessions = [...entries].sort(byTrainingTime).reverse();
  const best = estimateOneRepMax(sessions.flatMap((e) => e.sets));
  return (
    <div className="mt-2 space-y-1 rounded-field bg-muted/40 px-3 py-2" data-testid="exercise-history">
      {best !== undefined && <p className="ui-hint">Szacowane maksimum na 1 powtórzenie: <span className="font-mono tabular-nums text-foreground">{best} kg</span> (wzór Epleya, orientacyjnie)</p>}
      <ul className="divide-y divide-border/50 text-xs">
        {sessions.map((e) => {
          const volume = volumeOf(e.sets);
          return (
            <li key={e.id} className="flex flex-wrap justify-between gap-x-3 py-1">
              <span className="font-mono tabular-nums text-muted-foreground">{shortDay(e.day)}</span>
              <span className="min-w-0 flex-1">{setsLine(e.sets)}</span>
              {volume > 0 && <span className="font-mono tabular-nums text-muted-foreground">{Math.round(volume)} kg</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProgressList({ progress, entries }: { progress: ReturnType<typeof progressByExercise>; entries: TrainingEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
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
              <button type="button" aria-expanded={openId === p.exerciseId} aria-label={`Historia: ${exerciseById(p.exerciseId)?.name ?? p.exerciseId}`}
                onClick={() => setOpenId(openId === p.exerciseId ? null : p.exerciseId)}
                className="pressable flex w-full justify-between gap-3 rounded-field text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11 coarse:items-center">
                <span className="min-w-0 truncate">{exerciseById(p.exerciseId)?.name ?? p.exerciseId}</span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {p.bestKg !== undefined ? `rekord ${p.bestKg} kg (${shortDay(p.bestDay ?? "")})` : "bez ciężaru"} · {p.sessions}×
                </span>
              </button>
              {series.length >= 2 && <Sparkline values={series} label={`Rekordy kolejnych sesji: ${series.join(", ")} kg`} />}
              {openId === p.exerciseId && <ExerciseHistory entries={entries.filter((e) => e.exerciseId === p.exerciseId)} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Wykres kreskowy rekordów kolejnych sesji (SVG, bez biblioteki) z wyróżnionym punktem rekordu (4.3) i podpisaną
 * ostatnią wartością. Czytnik dostaje listę wartości w etykiecie.
 */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 160;
  const h = 28;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - 2 * pad) / (values.length - 1) : 0;
  const pt = (v: number, i: number) => ({ x: pad + i * step, y: h - pad - ((v - min) / span) * (h - 2 * pad) });
  const pts = values.map(pt);
  const recordAt = values.lastIndexOf(max);
  const last = pts[pts.length - 1];
  return (
    <div className="mt-1 flex items-center gap-2 text-primary-ink">
      <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} className="h-7 w-40 shrink-0">
        <polyline points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last.x} cy={last.y} r="2.5" fill="currentColor" />
        {recordAt !== values.length - 1 && <circle cx={pts[recordAt].x} cy={pts[recordAt].y} r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      </svg>
      <span aria-hidden className="font-mono text-xs tabular-nums text-muted-foreground">{values[values.length - 1]} kg{recordAt === values.length - 1 ? " · rekord" : ""}</span>
    </div>
  );
}
