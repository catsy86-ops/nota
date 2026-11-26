import { TRAINING_KG_MAX, TRAINING_RIR_MAX, type TrainingSet } from "@/lib/training/model";

/** C1.2: wydzielone z `TrainingSection.tsx` bez zmian zachowania. */

export function setsLine(sets: TrainingSet[]): string {
  return sets.map((s) => {
    if (s.seconds !== undefined) return s.kg !== undefined ? `${s.seconds} s +${s.kg} kg` : `${s.seconds} s`;
    const base = s.kg !== undefined ? `${s.reps}×${s.kg} kg` : `${s.reps}`;
    return s.rir !== undefined ? `${base} (zapas ${rirLabel(s.rir)})` : base;
  }).join(", ");
}

/** Zapas 4 znaczy „4 i więcej”. */
export const rirLabel = (rir: number) => (rir >= TRAINING_RIR_MAX ? `${TRAINING_RIR_MAX}+` : String(rir));

export interface SetRow { reps: string; kg: string }

export const emptyRow = (): SetRow => ({ reps: "", kg: "" });

/** Liczba z pola; pusta = brak, poza zakresem lub nie-liczba = `null`. */
export function parseNum(text: string, max: number, integer: boolean): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  if (integer && !Number.isInteger(n)) return null;
  return n;
}

/** Ciężar: co pół kilo (jak zapisuje model). Wpis 22,3 odrzucamy z podpowiedzią, zamiast zapisać 22,5 po cichu. */
export function parseKg(text: string): number | undefined | null {
  const n = parseNum(text, TRAINING_KG_MAX, false);
  if (n === undefined || n === null) return n;
  return Number.isInteger(n * 2) ? n : null;
}

export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function shortDay(key: string): string {
  const [, m, d] = key.split("-");
  return d && m ? `${d}.${m}` : key;
}
