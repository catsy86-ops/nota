import { useId, useMemo, useRef, useState } from "react";
import { Cylinder, Plus, Trash } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { metersLabel, parseMeters, PIPE_NAME_MAX, PIPES_MAX, suggestPipeNames, type Pipe } from "@/lib/study/pipes";

/** Długość z danych do pola: „24,5” (bez jednostki — „m” stoi obok pola). */
const fieldText = (cm: number) => (cm > 0 ? metersLabel(cm).replace(/ m$/, "") : "");

/**
 * Rury we wpisie (H1.1): nazwa z wymiarem i długość w metrach z przecinkiem. Pigułki średnic są
 * widoczne od razu — stuknięcie dodaje rurę i ustawia kursor w polu metrów (3 stuknięcia do zapisu).
 * Pole metrów trzyma tekst w trakcie pisania („24,”); do formularza idą centymetry, a zły tekst
 * daje 0 cm, które zapis odrzuca (`cleanPipes`).
 */
export function PipesFields({ value, history, onChange }: { value: Pipe[]; history: readonly (readonly Pipe[] | undefined)[]; onChange: (p: Pipe[]) => void }) {
  const listId = useId();
  const names = useMemo(() => suggestPipeNames(history, value.map((p) => p.name)), [history, value]);
  const [texts, setTexts] = useState<string[]>(() => value.map((p) => fieldText(p.cm)));
  const meterRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setRow = (i: number, patch: Partial<Pipe>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const add = (name = "") => {
    haptic("tap");
    onChange([...value, { name, cm: 0 }]);
    setTexts((t) => [...t, ""]);
    // Po dodaniu z pigułki od razu metry; pusta pozycja zaczyna od nazwy.
    const i = value.length;
    requestAnimationFrame(() => (name ? meterRefs.current[i] : document.getElementById(`${listId}-name-${i}`))?.focus());
  };
  const remove = (i: number) => {
    onChange(value.filter((_, j) => j !== i));
    setTexts((t) => t.filter((_, j) => j !== i));
  };
  const setMeters = (i: number, text: string) => {
    setTexts((t) => t.map((x, j) => (j === i ? text : x)));
    setRow(i, { cm: parseMeters(text) ?? 0 });
  };

  const chips = value.length < PIPES_MAX && (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Dodaj rurę">
      {names.slice(0, 6).map((n) => (
        <button key={n} type="button" onClick={() => add(n)} className="pressable rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-primary/10 coarse:min-h-11 coarse:px-3 coarse:text-sm">
          {n}
        </button>
      ))}
      <button type="button" onClick={() => add()} className="pressable inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted coarse:min-h-11 coarse:px-3 coarse:text-sm">
        <Plus className="h-3.5 w-3.5" aria-hidden />Inna
      </button>
    </div>
  );

  return (
    <fieldset className="min-w-0 space-y-2" data-testid="pipes">
      <legend className="flex items-center gap-2 text-sm font-medium"><Cylinder className="h-4 w-4 text-primary-ink" aria-hidden />Rury</legend>
      <datalist id={listId}>{names.map((n) => <option key={n} value={n} />)}</datalist>
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((p, i) => {
            const text = texts[i] ?? "";
            const invalid = text.trim() !== "" && parseMeters(text) === null;
            return (
              <li key={i} className="flex items-center gap-1.5">
                <input
                  id={`${listId}-name-${i}`}
                  value={p.name}
                  list={listId}
                  maxLength={PIPE_NAME_MAX}
                  onChange={(e) => setRow(i, { name: e.target.value })}
                  placeholder="np. Rura PEX 16×2"
                  aria-label={`Rura ${i + 1}: nazwa`}
                  className="h-10 min-w-0 flex-1 rounded-field border border-input bg-background px-2.5 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
                />
                <label className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                  <input
                    ref={(el) => { meterRefs.current[i] = el; }}
                    value={text}
                    inputMode="decimal"
                    enterKeyHint="done"
                    onChange={(e) => setMeters(i, e.target.value)}
                    placeholder="0"
                    aria-label={`${p.name || `Rura ${i + 1}`}: metry`}
                    aria-invalid={invalid || undefined}
                    className={cn(
                      "h-10 w-16 rounded-field border bg-background px-2 text-right font-mono text-base tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11",
                      invalid ? "border-destructive" : "border-input",
                    )}
                  />
                  m
                </label>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Usuń rurę ${p.name || i + 1}`}
                  className="pressable grid size-10 shrink-0 place-items-center rounded-field border border-border text-muted-foreground coarse:size-11"
                >
                  <Trash className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {value.some((_, i) => (texts[i] ?? "").trim() !== "" && parseMeters(texts[i]) === null) && (
        <p role="alert" className="text-xs text-destructive-ink">Wpisz metry jak 24, 24,5 albo 3,75.</p>
      )}
      {chips}
    </fieldset>
  );
}
