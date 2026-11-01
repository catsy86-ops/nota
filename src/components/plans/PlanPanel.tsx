import { useEffect, useState } from "react";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { calibrationError, distance, lengthLabel, measureRoute, parseDecimal, polylineLength } from "@/lib/plans/geometry";
import { cleanDiameter, PLAN_LABEL_MAX, SYSTEM_TYPES, type PipeRoute, type PlanCalibration, type PlanPoint, type SystemType } from "@/lib/plans/model";
import { COMMON_DIAMETERS, SYSTEM_META } from "@/lib/plans/systems";
import { cn } from "@/lib/utils";

export type EditorMode = "select" | "route" | "calibrate";

const field = "h-10 w-full rounded-field border border-border bg-background px-3 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";
const sectionCls = "space-y-2 border-b border-border/60 px-3 py-3 last:border-b-0";
const h3 = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

const fmt = (n: number, d = 2) => n.toLocaleString("pl-PL", { maximumFractionDigits: d });

export function SystemSelect({ value, onChange, id }: { value: SystemType; onChange: (s: SystemType) => void; id?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as SystemType)} className={field}>
      {SYSTEM_TYPES.map((s) => <option key={s} value={s}>{SYSTEM_META[s].label} ({SYSTEM_META[s].short})</option>)}
    </select>
  );
}

/** Skala: stan, wpisanie znanej długości po dwóch punktach, usunięcie. */
export function ScaleSection({ mode, calibration, calDraft, mpp, onStart, onSave, onCancel, onClear }: {
  mode: EditorMode;
  calibration: PlanCalibration | null;
  calDraft: readonly PlanPoint[];
  mpp: number | null;
  onStart: () => void;
  onSave: (meters: number) => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  const [meters, setMeters] = useState("");
  useEffect(() => { if (mode !== "calibrate") setMeters(""); }, [mode]);
  const value = parseDecimal(meters);
  const err = calDraft.length === 2 && meters ? calibrationError(calDraft[0], calDraft[1], value) : null;

  if (mode === "calibrate") {
    return (
      <section className={sectionCls} aria-label="Ustawianie skali" data-testid="plan-scale">
        <h3 className={h3}>Ustaw skalę</h3>
        <p className="text-sm">
          {calDraft.length === 0 && "Stuknij początek odcinka o znanej długości (np. wymiar ściany na planie)."}
          {calDraft.length === 1 && "Stuknij koniec tego odcinka."}
          {calDraft.length === 2 && `Odcinek ma ${fmt(distance(calDraft[0], calDraft[1]), 0)} px. Wpisz jego prawdziwą długość.`}
        </p>
        {calDraft.length === 2 && (
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (!err && Number.isFinite(value)) onSave(value); }}>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Długość w metrach</span>
              <input value={meters} onChange={(e) => setMeters(e.target.value)} inputMode="decimal" autoFocus placeholder="np. 4,20" className={cn(field, "font-mono tabular-nums")} aria-invalid={!!err} />
            </label>
            {err && <p role="alert" className="text-xs text-destructive-ink">{err === "short" ? "Odcinek jest za krótki — wybierz dłuższy wymiar (co najmniej 10 px)." : "Wpisz długość większą od zera, np. 4,20."}</p>}
            <Button type="submit" disabled={!Number.isFinite(value) || !!err} className="pressable w-full coarse:h-11">Zapisz skalę</Button>
          </form>
        )}
        <Button type="button" variant="outline" onClick={onCancel} className="pressable w-full coarse:h-11">Anuluj</Button>
      </section>
    );
  }
  return (
    <section className={sectionCls} aria-label="Skala" data-testid="plan-scale">
      <h3 className={h3}>Skala</h3>
      {mpp === null ? (
        <p className="text-sm text-muted-foreground">Bez skali — długości są w pikselach. Ustaw skalę z jednego znanego wymiaru, żeby liczyć metry.</p>
      ) : (
        <p className="text-sm"><span className="font-mono tabular-nums">1 m = {fmt(1 / mpp, 1)} px</span><span className="text-muted-foreground"> · z odcinka {fmt(calibration!.meters, 3)} m</span></p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant={mpp === null ? "default" : "outline"} onClick={onStart} className="pressable flex-1 coarse:h-11">{mpp === null ? "Ustaw skalę" : "Zmień skalę"}</Button>
        {mpp !== null && <Button type="button" variant="ghost" onClick={onClear} className="pressable coarse:h-11">Usuń</Button>}
      </div>
    </section>
  );
}

/** Rysowanie trasy: instalacja nowej trasy, długość szkicu, cofnij punkt, zakończ. */
export function DraftSection({ draft, mpp, system, onSystem, snap, onSnap, onUndoPoint, onFinish, onCancel }: {
  draft: readonly number[];
  mpp: number | null;
  system: SystemType;
  onSystem: (s: SystemType) => void;
  snap: boolean;
  onSnap: (on: boolean) => void;
  onUndoPoint: () => void;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const n = draft.length / 2;
  const m = measureRoute({ pts: draft, verified: true }, mpp);
  return (
    <section className={sectionCls} aria-label="Nowa trasa" data-testid="plan-draft-panel">
      <h3 className={h3}>Nowa trasa</h3>
      <p className="text-sm">
        {n === 0 ? "Stuknij początek rury na planie, potem kolejne załamania." : <>Punkty: <span className="font-mono tabular-nums">{n}</span>{n >= 2 && <> · <span className="font-mono tabular-nums" data-testid="plan-draft-length">{lengthLabel(m)}</span></>}</>}
      </p>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Instalacja</span>
        <SystemSelect value={system} onChange={onSystem} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={snap} onCheckedChange={(v) => onSnap(v === true)} />
        Prosto (co 45°)
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={onUndoPoint} disabled={n === 0} className="pressable coarse:h-11">Cofnij punkt</Button>
        <Button type="button" onClick={onFinish} disabled={n < 2} className="pressable coarse:h-11">Zakończ trasę</Button>
      </div>
      <Button type="button" variant="ghost" onClick={onCancel} className="pressable w-full coarse:h-11">Anuluj rysowanie</Button>
      <p className="text-xs text-muted-foreground">Klawiatura: spacja dodaje punkt w celowniku, Backspace cofa punkt, Enter kończy, Esc anuluje.</p>
    </section>
  );
}

/** Właściwości zaznaczonej trasy: instalacja, średnica, szacunek, zatwierdzenie, opis, usunięcie. */
export function RouteSection({ route, mpp, onChange, onDelete }: { route: PipeRoute; mpp: number | null; onChange: (r: PipeRoute) => void; onDelete: () => void }) {
  const [diameter, setDiameter] = useState(route.diameterMm ? String(route.diameterMm).replace(".", ",") : "");
  const [label, setLabel] = useState(route.label ?? "");
  useEffect(() => { setDiameter(route.diameterMm ? String(route.diameterMm).replace(".", ",") : ""); setLabel(route.label ?? ""); }, [route.id, route.diameterMm, route.label]);
  const m = measureRoute(route, mpp);
  const d = parseDecimal(diameter);
  const badDiameter = diameter.trim() !== "" && cleanDiameter(d) === undefined;

  function commitDiameter() {
    if (badDiameter) return;
    const next = diameter.trim() === "" ? undefined : cleanDiameter(d);
    if (next === route.diameterMm) return;
    const { diameterMm: _d, ...rest } = route;
    onChange(next === undefined ? rest : { ...rest, diameterMm: next });
  }
  function commitLabel() {
    const next = label.trim().slice(0, PLAN_LABEL_MAX);
    if (next === (route.label ?? "")) return;
    const { label: _l, ...rest } = route;
    onChange(next ? { ...rest, label: next } : rest);
  }

  return (
    <section className={sectionCls} aria-label="Zaznaczona trasa" data-testid="plan-route-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className={h3}>Trasa</h3>
        <span className="font-mono text-sm tabular-nums" data-testid="plan-route-length">{lengthLabel(m)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{route.pts.length / 2} punktów · {Math.round(polylineLength(route.pts))} px. Przeciągnij biały punkt, żeby poprawić przebieg.</p>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Instalacja</span>
        <SystemSelect value={route.system} onChange={(system) => onChange({ ...route, system })} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Średnica (mm)</span>
        <input value={diameter} onChange={(e) => setDiameter(e.target.value)} onBlur={commitDiameter} onKeyDown={(e) => { if (e.key === "Enter") commitDiameter(); }}
          inputMode="decimal" list="plan-diameters" placeholder="np. 16" className={cn(field, "font-mono tabular-nums")} aria-invalid={badDiameter} />
        <datalist id="plan-diameters">{COMMON_DIAMETERS.map((v) => <option key={v} value={v} />)}</datalist>
        {badDiameter && <span role="alert" className="block text-xs text-destructive-ink">Wpisz średnicę od 6 do 1000 mm.</span>}
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Opis</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={commitLabel} onKeyDown={(e) => { if (e.key === "Enter") commitLabel(); }} maxLength={PLAN_LABEL_MAX} placeholder="np. podejście do umywalki" className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={route.verified} onCheckedChange={(v) => onChange({ ...route, verified: v === true })} />
        Zatwierdzona
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={!!route.estimate} onCheckedChange={(v) => { const { estimate: _e, ...rest } = route; onChange(v === true ? { ...rest, estimate: true } : rest); }} />
        Długość szacunkowa
      </label>
      <Button type="button" variant="outline" onClick={onDelete} className="pressable w-full text-destructive-ink coarse:h-11"><Trash className="mr-1.5 h-4 w-4" aria-hidden />Usuń trasę</Button>
    </section>
  );
}

/** Lista tras analizy: kolor instalacji, średnica, długość; stuknięcie zaznacza trasę na planie. */
export function RoutesList({ routes, mpp, selectedId, onSelect }: { routes: readonly PipeRoute[]; mpp: number | null; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <section className={sectionCls} aria-label="Trasy" data-testid="plan-routes">
      <h3 className={h3}>Trasy ({routes.length})</h3>
      {routes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak tras. Wybierz „Trasa” i stukaj kolejne punkty rury na planie.</p>
      ) : (
        <ul className="space-y-0.5">
          {routes.map((r, i) => (
            <li key={r.id}>
              <button type="button" onClick={() => onSelect(r.id)} aria-pressed={r.id === selectedId}
                className={cn("flex min-h-10 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11", r.id === selectedId && "bg-muted")}>
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: SYSTEM_META[r.system].color }} />
                <span className="min-w-0 flex-1 truncate">{r.label || `${SYSTEM_META[r.system].short} ${i + 1}`}{r.diameterMm ? ` · Ø${String(r.diameterMm).replace(".", ",")}` : ""}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{lengthLabel(measureRoute(r, mpp)).replace(" (bez skali)", "")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
