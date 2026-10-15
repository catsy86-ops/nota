import { useId, useMemo } from "react";
import { Minus, Package, Plus, Trash } from "lucide-react";
import { FITTING_NAME_MAX, FITTING_QTY_MAX, FITTINGS_MAX, suggestFittingNames, type Fitting } from "@/lib/study/fittings";

/**
 * Kształtki we wpisie: nazwa (z podpowiedziami z poprzednich wpisów) i liczba sztuk
 * z dużymi −/+ pod kciuk. Wiersze w trakcie pisania mogą mieć pustą nazwę — czyści je
 * dopiero zapis wpisu (`cleanFittings` w `entryFields`).
 */
export function FittingsFields({ value, history, onChange }: { value: Fitting[]; history: readonly (readonly Fitting[] | undefined)[]; onChange: (f: Fitting[]) => void }) {
  const listId = useId();
  const names = useMemo(() => suggestFittingNames(history, value.map((f) => f.name)), [history, value]);
  const setRow = (i: number, patch: Partial<Fitting>) => onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const add = (name = "") => onChange([...value, { name, qty: 1 }]);

  if (value.length === 0) {
    return (
      <button
        type="button"
        onClick={() => add()}
        className="pressable flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted coarse:min-h-12"
      >
        <Package className="h-4 w-4 shrink-0" aria-hidden />Dodaj kształtki
      </button>
    );
  }
  return (
    <fieldset className="min-w-0 space-y-2 rounded-xl border border-border p-3" data-testid="fittings">
      <legend className="sr-only">Kształtki</legend>
      <p className="flex items-center gap-2 text-sm font-medium"><Package className="h-4 w-4 text-primary-ink" aria-hidden />Kształtki</p>
      <datalist id={listId}>{names.map((n) => <option key={n} value={n} />)}</datalist>
      <ul className="space-y-2">
        {value.map((f, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input
              value={f.name}
              list={listId}
              maxLength={FITTING_NAME_MAX}
              onChange={(e) => setRow(i, { name: e.target.value })}
              placeholder="np. Kolano 16"
              aria-label={`Kształtka ${i + 1}: nazwa`}
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
            />
            {/* „−” przy 1 sztuce usuwa pozycję — bez osobnego „×”, który nie mieścił się w 390 px. */}
            <button
              type="button"
              onClick={() => (f.qty <= 1 ? onChange(value.filter((_, j) => j !== i)) : setRow(i, { qty: f.qty - 1 }))}
              aria-label={f.qty <= 1 ? `Usuń kształtkę ${f.name || i + 1}` : `${f.name || "Kształtka"}: mniej`}
              className="pressable grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground coarse:size-11"
            >
              {f.qty <= 1 ? <Trash className="h-4 w-4" aria-hidden /> : <Minus className="h-4 w-4" aria-hidden />}
            </button>
            <span className="w-8 shrink-0 text-center font-mono text-base font-semibold tabular-nums" aria-label={`${f.qty} szt.`} data-testid="fitting-qty">{f.qty}</span>
            <button type="button" onClick={() => setRow(i, { qty: Math.min(FITTING_QTY_MAX, f.qty + 1) })} aria-label={`${f.name || "Kształtka"}: więcej`} className="pressable grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground coarse:size-11">
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {value.length < FITTINGS_MAX && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => add()} className="pressable inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted coarse:min-h-11 coarse:px-3 coarse:text-sm">
            <Plus className="h-3.5 w-3.5" aria-hidden />Kolejna
          </button>
          {/* Szybkie pigułki: najczęstsze nazwy jednym stuknięciem. */}
          {names.slice(0, 4).map((n) => (
            <button key={n} type="button" onClick={() => add(n)} className="pressable rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-primary/10 coarse:min-h-11 coarse:px-3 coarse:text-sm">
              {n}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
