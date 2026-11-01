import { Plus, Trash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { FittingProposal } from "@/lib/plans/fittings";
import { SYMBOL_TYPES, SYSTEM_TYPES, type DetectedSymbol, type SymbolType, type SystemType } from "@/lib/plans/model";
import { SYMBOL_META, SYSTEM_META } from "@/lib/plans/systems";
import { cn } from "@/lib/utils";

const sectionCls = "space-y-2 border-b border-border/60 px-3 py-3 last:border-b-0";
const h3 = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const field = "h-10 w-full rounded-field border border-border bg-background px-3 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";
const pct = (v: number) => `${Math.round(v * 100)}%`;

function OptionalSystem({ value, onChange }: { value: SystemType | undefined; onChange: (s: SystemType | undefined) => void }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as SystemType | undefined)} className={field}>
      <option value="">— bez instalacji —</option>
      {SYSTEM_TYPES.map((s) => <option key={s} value={s}>{SYSTEM_META[s].label} ({SYSTEM_META[s].short})</option>)}
    </select>
  );
}

/** Narzędzie „Symbol”: jaki symbol postawi stuknięcie. */
export function SymbolPlaceSection({ type, onType, system, onSystem }: { type: SymbolType; onType: (t: SymbolType) => void; system: SystemType | undefined; onSystem: (s: SystemType | undefined) => void }) {
  return (
    <section className={sectionCls} aria-label="Nowy symbol" data-testid="plan-symbol-place">
      <h3 className={h3}>Nowy symbol</h3>
      <p className="text-sm">Stuknij miejsce na planie, żeby postawić symbol.</p>
      <div role="radiogroup" aria-label="Rodzaj symbolu" className="grid grid-cols-2 gap-1.5">
        {SYMBOL_TYPES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => onType(t)}
            className={cn("min-h-10 rounded-control border px-2 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11",
              type === t ? "border-primary bg-primary/10 font-medium" : "border-border/60 hover:bg-muted")}>
            {SYMBOL_META[t].label}
          </button>
        ))}
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Instalacja</span>
        <OptionalSystem value={system} onChange={onSystem} />
      </label>
    </section>
  );
}

/** Zaznaczony symbol: rodzaj, instalacja, zatwierdzenie, pochodzenie, usunięcie. */
export function SymbolSection({ symbol, onChange, onDelete }: { symbol: DetectedSymbol; onChange: (s: DetectedSymbol) => void; onDelete: () => void }) {
  return (
    <section className={sectionCls} aria-label="Zaznaczony symbol" data-testid="plan-symbol-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className={h3}>Symbol</h3>
        <span className="text-xs text-muted-foreground">{symbol.manual ? "dodany ręcznie" : `z ${symbol.confidence !== undefined ? `geometrii · ${pct(symbol.confidence)}` : "rozpoznania"}`}</span>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Rodzaj</span>
        <select value={symbol.type} onChange={(e) => onChange({ ...symbol, type: e.target.value as SymbolType })} className={field}>
          {SYMBOL_TYPES.map((t) => <option key={t} value={t}>{SYMBOL_META[t].label}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Instalacja</span>
        <OptionalSystem value={symbol.system} onChange={(system) => { const { system: _s, ...rest } = symbol; onChange(system ? { ...rest, system } : rest); }} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={symbol.verified} onCheckedChange={(v) => onChange({ ...symbol, verified: v === true })} />
        Zatwierdzony
      </label>
      <Button type="button" variant="outline" onClick={onDelete} className="pressable w-full text-destructive-ink coarse:h-11"><Trash className="mr-1.5 h-4 w-4" aria-hidden />Usuń symbol</Button>
    </section>
  );
}

/** Kolana i trójniki z geometrii tras + lista symboli na planie. */
export function FittingsSection({ proposals, symbols, routesCount, selectedId, focusId, onFocus, onPropose, onAdd, onReject, onAddAll, onSelect }: {
  proposals: readonly (FittingProposal & { id: string })[];
  symbols: readonly DetectedSymbol[];
  routesCount: number;
  selectedId: string | null;
  focusId: string | null;
  onFocus: (id: string | null) => void;
  onPropose: () => void;
  onAdd: (p: FittingProposal & { id: string }) => void;
  onReject: (id: string) => void;
  onAddAll: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className={sectionCls} aria-label="Symbole" data-testid="plan-symbols">
      <h3 className={h3}>Symbole ({symbols.length})</h3>
      <Button type="button" variant="outline" onClick={onPropose} disabled={routesCount === 0} className="pressable w-full coarse:h-11">Zaproponuj kolana i trójniki z tras</Button>
      {proposals.length > 0 && (
        <div className="space-y-1" data-testid="plan-fitting-proposals">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Do sprawdzenia ({proposals.length})</p>
            <Button type="button" variant="ghost" onClick={onAddAll} className="pressable h-9 px-2 text-xs coarse:h-11">Dodaj wszystkie</Button>
          </div>
          <ul className="space-y-0.5">
            {proposals.map((p) => (
              <li key={p.id} className={cn("flex items-center gap-1 rounded-control px-1.5", focusId === p.id && "bg-primary/10")} onMouseEnter={() => onFocus(p.id)} onMouseLeave={() => onFocus(null)}>
                <span className="min-w-0 flex-1 truncate py-1.5 text-sm">{SYMBOL_META[p.type].label} · {SYSTEM_META[p.system].short} <span className="text-xs text-muted-foreground">· pewność {pct(p.confidence)}</span></span>
                <button type="button" onClick={() => onAdd(p)} aria-label={`Dodaj: ${SYMBOL_META[p.type].label}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-primary-ink hover:bg-primary/10 outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-11"><Plus className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={() => onReject(p.id)} aria-label={`Odrzuć: ${SYMBOL_META[p.type].label}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-11"><X className="h-4 w-4" aria-hidden /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {symbols.length > 0 && (
        <ul className="space-y-0.5">
          {symbols.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onSelect(s.id)} aria-pressed={s.id === selectedId}
                className={cn("flex min-h-10 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11", s.id === selectedId && "bg-muted")}>
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full border-2" style={{ borderColor: s.system ? SYSTEM_META[s.system].color : "#6b7280" }} />
                <span className="min-w-0 flex-1 truncate">{SYMBOL_META[s.type].label}{s.system ? ` · ${SYSTEM_META[s.system].short}` : ""}</span>
                <span className="text-xs text-muted-foreground">{s.verified ? (s.manual ? "ręczny" : "zatwierdzony") : "do sprawdzenia"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
