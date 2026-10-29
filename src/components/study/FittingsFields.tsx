import { useId, useMemo, useRef } from "react";
import { Mic, Minus, Package, Plus, Trash } from "lucide-react";
import { toast } from "sonner";
import { useDictation } from "@/hooks/useDictation";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { FITTING_NAME_MAX, FITTING_QTY_MAX, FITTINGS_MAX, fittingKey, fittingsLine, sumFittings, suggestFittingNames, type Fitting } from "@/lib/study/fittings";
import { catalogFittings, useCatalogPrefs } from "@/lib/study/catalog";
import { SystemPicker } from "./SystemPicker";
import { mergeFittings, parseSpokenFittings } from "@/lib/study/spokenFittings";

/**
 * Kształtki we wpisie: nazwa (z podpowiedziami z poprzednich wpisów) i liczba sztuk
 * z pigułek: ostatnio używane i katalog systemu i średnicy (H1.5) — widoczne od razu, bez osobnego
 * „Dodaj kształtki”. Liczba sztuk
 * z dużymi −/+ pod kciuk. Wiersze w trakcie pisania mogą mieć pustą nazwę — czyści je
 * dopiero zapis wpisu (`cleanFittings` w `entryFields`). Mikrofon dyktuje kilka pozycji
 * naraz („kolano 16 cztery sztuki, trójnik 16 dwa”) — parser w `spokenFittings.ts`.
 */
export function FittingsFields({ value, history, onChange }: { value: Fitting[]; history: readonly (readonly Fitting[] | undefined)[]; onChange: (f: Fitting[]) => void }) {
  const listId = useId();
  const names = useMemo(() => suggestFittingNames(history, value.map((f) => f.name)), [history, value]);
  // Pisownia nazw do dopasowania dyktowania: wszystkie znane, także już dodane do wpisu.
  const known = useMemo(() => suggestFittingNames(history, []), [history]);
  const setRow = (i: number, patch: Partial<Fitting>) => onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const add = (name = "") => {
    // Ta sama pozycja z pigułki drugi raz dokłada sztukę, zamiast dublować wiersz.
    const i = name ? value.findIndex((f) => fittingKey(f.name) === fittingKey(name)) : -1;
    if (i >= 0) { setRow(i, { qty: Math.min(FITTING_QTY_MAX, value[i].qty + 1) }); return; }
    onChange([...value, { name, qty: 1 }]);
  };
  const prefs = useCatalogPrefs();
  const taken = new Set(value.map((f) => fittingKey(f.name)));
  const recent = sumFittings(history).map((f) => f.name).filter((n) => !taken.has(fittingKey(n))).slice(0, 4);
  const shown = new Set([...taken, ...recent.map(fittingKey)]);
  const catalog = catalogFittings(prefs.system, prefs.size).filter((n) => !shown.has(fittingKey(n)));

  // Kilka wyników mowy potrafi przyjść między renderami — lista z refu, żeby żaden nie zginął.
  const valueRef = useRef(value);
  valueRef.current = value;
  const dictation = useDictation((spoken) => {
    const parsed = parseSpokenFittings(spoken, known);
    if (parsed.length === 0) {
      toast("Nie rozpoznałem kształtek", { id: "fittings-dictation", description: `Usłyszałem: „${spoken}”. Powiedz np. „kolano 16 cztery sztuki”.` });
      return;
    }
    const next = mergeFittings(valueRef.current, parsed);
    valueRef.current = next;
    onChange(next);
    haptic("success");
    toast.success(`Dodano: ${fittingsLine(parsed)}`, { id: "fittings-dictation" });
  });
  const mic = dictation.supported && (
    <button
      type="button"
      onClick={() => { haptic("tap"); dictation.toggle(); }}
      aria-pressed={dictation.listening}
      aria-label={dictation.listening ? "Zakończ dyktowanie kształtek" : "Dyktuj kształtki"}
      title="Powiedz np. „kolano 16 cztery sztuki, trójnik 16 dwa”"
      className={cn(
        "pressable inline-flex shrink-0 items-center gap-1.5 rounded-card border px-3 py-2 text-sm coarse:min-h-12",
        dictation.listening ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      <Mic className={cn("h-4 w-4", dictation.listening && "animate-pulse")} aria-hidden />
      {dictation.listening ? "Słucham…" : "Dyktuj"}
    </button>
  );

  return (
    <fieldset className="min-w-0 space-y-2 rounded-card border border-border p-3" data-testid="fittings">
      <legend className="sr-only">Kształtki</legend>
      <p className="flex items-center gap-2 text-sm font-medium"><Package className="h-4 w-4 text-primary-ink" aria-hidden />Kształtki</p>
      <datalist id={listId}>{names.map((n) => <option key={n} value={n} />)}</datalist>
      {value.length > 0 && <ul className="space-y-2">
        {value.map((f, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input
              value={f.name}
              list={listId}
              maxLength={FITTING_NAME_MAX}
              onChange={(e) => setRow(i, { name: e.target.value })}
              placeholder="np. Kolano 16"
              aria-label={`Kształtka ${i + 1}: nazwa`}
              className="h-10 min-w-0 flex-1 rounded-field border border-input bg-background px-2.5 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
            />
            {/* „−” przy 1 sztuce usuwa pozycję — bez osobnego „×”, który nie mieścił się w 390 px. */}
            <button
              type="button"
              onClick={() => (f.qty <= 1 ? onChange(value.filter((_, j) => j !== i)) : setRow(i, { qty: f.qty - 1 }))}
              aria-label={f.qty <= 1 ? `Usuń kształtkę ${f.name || i + 1}` : `${f.name || "Kształtka"}: mniej`}
              className="pressable grid size-10 shrink-0 place-items-center rounded-field border border-border text-muted-foreground coarse:size-11"
            >
              {f.qty <= 1 ? <Trash className="h-4 w-4" aria-hidden /> : <Minus className="h-4 w-4" aria-hidden />}
            </button>
            <span className="w-8 shrink-0 text-center font-mono text-base font-semibold tabular-nums" aria-label={`${f.qty} szt.`} data-testid="fitting-qty">{f.qty}</span>
            <button type="button" onClick={() => setRow(i, { qty: Math.min(FITTING_QTY_MAX, f.qty + 1) })} aria-label={`${f.name || "Kształtka"}: więcej`} className="pressable grid size-10 shrink-0 place-items-center rounded-field border border-border text-muted-foreground coarse:size-11">
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>}
      {value.length < FITTINGS_MAX && (
        <div className="space-y-2">
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ostatnio używane kształtki">
              {recent.map((n) => (
                <button key={n} type="button" onClick={() => add(n)} className="pressable rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-primary/10 coarse:min-h-11 coarse:px-3 coarse:text-sm">
                  {n}
                </button>
              ))}
            </div>
          )}
          <SystemPicker sizes />
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Kształtki z katalogu">
            {catalog.map((n) => (
              <button key={n} type="button" onClick={() => add(n)} className="pressable rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-primary/10 coarse:min-h-11 coarse:px-3 coarse:text-sm">
                {n}
              </button>
            ))}
            <button type="button" onClick={() => add()} className="pressable inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted coarse:min-h-11 coarse:px-3 coarse:text-sm">
              <Plus className="h-3.5 w-3.5" aria-hidden />Inna
            </button>
            {mic}
          </div>
        </div>
      )}
    </fieldset>
  );
}
