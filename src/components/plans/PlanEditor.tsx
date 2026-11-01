import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Maximize, Minus, MousePointer2, Pencil, Plus, Redo2, Ruler, Spline, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useImageUrl } from "@/hooks/useImageUrl";
import { metersPerPixel, pickRoute, pickVertex } from "@/lib/plans/geometry";
import { PLAN_NAME_MAX, PLAN_ROUTE_POINTS_MAX, type PipeRoute, type PlanPoint, type SystemType } from "@/lib/plans/model";
import {
  clearPlansUndo, newPlanId, redoPlans, removePlanEntity, renamePlan, savePlanEntity, setPlanCalibration, stopPlansCapture, undoPlans, usePlansUndo,
} from "@/lib/plans/plansStore";
import { snapAngle } from "@/lib/plans/systems";
import type { PlanData } from "@/lib/plans/yPlans";
import { toastWithUndo } from "@/lib/undoToast";
import { modShortcut } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { PlanCanvas, type PlanCanvasHandle } from "./PlanCanvas";
import { PlanOverlay } from "./PlanOverlay";
import { DraftSection, RouteSection, RoutesList, ScaleSection, type EditorMode } from "./PlanPanel";

const toolBtn = "pressable inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent coarse:h-11 coarse:min-w-11";
/** Promień trafienia trasy i punktu w pikselach EKRANU (palec ~ 10 mm). */
const HIT_ROUTE_PX = 14;
const HIT_HANDLE_PX = 18;

const MODES: { id: EditorMode; label: string; Icon: typeof Ruler }[] = [
  { id: "select", label: "Zaznacz", Icon: MousePointer2 },
  { id: "route", label: "Trasa", Icon: Spline },
  { id: "calibrate", label: "Skala", Icon: Ruler },
];

/**
 * Edytor jednej analizy (faza 3): tryby „Zaznacz” (stuknięcie wybiera trasę, przeciąganie punktu poprawia
 * przebieg), „Trasa” (stuknięcia dodają punkty, „Zakończ” zapisuje) i „Skala” (dwa punkty + znana długość).
 * Przesuwanie i przybliżanie działa w każdym trybie — krótkie stuknięcie to akcja, ruch to przesunięcie.
 */
export function PlanEditor({ plan, onBack }: { plan: PlanData; onBack: () => void }) {
  const { project, routes, calibration } = plan;
  const pid = project.id;
  const canvas = useRef<PlanCanvasHandle>(null);
  const workUrl = useImageUrl(project.work?.ref ?? "");
  // Oryginał wczytujemy tylko bez kopii roboczej albo gdy jej bajtów nie ma tu (`null`) — nie oba naraz.
  const needOriginal = !project.work || workUrl === null;
  const imageUrl = useImageUrl(needOriginal ? project.image.ref : "");
  const url = needOriginal ? imageUrl : workUrl;

  const [mode, setMode] = useState<EditorMode>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<number[]>([]);
  const [draftSystem, setDraftSystem] = useState<SystemType>("cold");
  const [snap, setSnap] = useState(false);
  const [hover, setHover] = useState<PlanPoint | null>(null);
  const [calDraft, setCalDraft] = useState<PlanPoint[]>([]);
  /** Przeciągany punkt zaznaczonej trasy: punkty na czas ruchu, zapis dopiero po puszczeniu. */
  const [drag, setDrag] = useState<{ index: number; pts: number[] } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const undo = usePlansUndo();
  const mpp = metersPerPixel(calibration);

  // Każda analiza ma własny stos „Cofnij”.
  useEffect(() => { clearPlansUndo(); }, [pid]);
  // Trasa usunięta (np. „Cofnij” albo drugie urządzenie) — zaznaczenie znika.
  useEffect(() => { if (selectedId && !routes.some((r) => r.id === selectedId)) setSelectedId(null); }, [routes, selectedId]);

  const shownRoutes = useMemo(
    () => (drag && selectedId ? routes.map((r) => (r.id === selectedId ? { ...r, pts: drag.pts } : r)) : routes),
    [routes, drag, selectedId],
  );
  const selected = routes.find((r) => r.id === selectedId) ?? null;

  const switchMode = useCallback((m: EditorMode) => {
    setMode(m);
    setDraft([]);
    setCalDraft([]);
    setHover(null);
    if (m !== "select") setSelectedId(null);
  }, []);

  const addDraftPoint = useCallback((p: PlanPoint) => {
    setDraft((d) => {
      if (d.length >= PLAN_ROUTE_POINTS_MAX * 2) return d;
      const q = snap && d.length >= 2 ? snapAngle({ x: d[d.length - 2], y: d[d.length - 1] }, p) : p;
      return [...d, Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10];
    });
  }, [snap]);

  const finishRoute = useCallback(() => {
    if (draft.length < 4) return;
    const route: PipeRoute = { id: newPlanId("route"), system: draftSystem, pts: draft, source: "manual", verified: true, at: Date.now() };
    stopPlansCapture();
    if (!savePlanEntity("r", pid, route)) { toast.error("Nie udało się zapisać trasy (limit 500 tras w analizie)."); return; }
    setDraft([]);
    setHover(null);
    setMode("select");
    setSelectedId(route.id);
  }, [draft, draftSystem, pid]);

  const deleteRoute = useCallback((id: string) => {
    stopPlansCapture();
    const removed = removePlanEntity("r", pid, id);
    if (removed) toastWithUndo("Usunięto trasę", () => savePlanEntity("r", pid, removed));
  }, [pid]);

  const onTap = useCallback((p: PlanPoint) => {
    if (mode === "route") { addDraftPoint(p); return; }
    if (mode === "calibrate") { setCalDraft((c) => (c.length >= 2 ? [p] : [...c, p])); return; }
    const scale = canvas.current?.view().scale ?? 1;
    setSelectedId(pickRoute(routes, p, HIT_ROUTE_PX / scale));
  }, [mode, addDraftPoint, routes]);

  const onPressStart = useCallback((p: PlanPoint, scale: number) => {
    if (mode !== "select" || !selected) return false;
    const index = pickVertex(selected.pts, p, HIT_HANDLE_PX / scale);
    if (index < 0) return false;
    setDrag({ index, pts: selected.pts.slice() });
    return true;
  }, [mode, selected]);

  const onPressMove = useCallback((p: PlanPoint) => {
    setDrag((d) => {
      if (!d) return d;
      const pts = d.pts.slice();
      pts[d.index * 2] = Math.round(p.x * 10) / 10;
      pts[d.index * 2 + 1] = Math.round(p.y * 10) / 10;
      return { ...d, pts };
    });
  }, []);

  const onPressEnd = useCallback(() => {
    setDrag((d) => {
      if (d && selected) {
        stopPlansCapture();
        savePlanEntity("r", pid, { ...selected, pts: d.pts, at: selected.at });
      }
      return null;
    });
  }, [selected, pid]);

  const onKeyAction = useCallback((key: string, center: PlanPoint) => {
    if (key === "Escape") { if (mode !== "select" || selectedId) { switchMode("select"); setSelectedId(null); return true; } return false; }
    if (mode === "route") {
      if (key === " ") { addDraftPoint(center); return true; }
      if (key === "Backspace") { setDraft((d) => d.slice(0, -2)); return true; }
      if (key === "Enter") { finishRoute(); return true; }
    }
    if (mode === "calibrate" && key === " ") { setCalDraft((c) => (c.length >= 2 ? [center] : [...c, center])); return true; }
    if (mode === "select" && selectedId && (key === "Delete" || key === "Backspace")) { deleteRoute(selectedId); return true; }
    return false;
  }, [mode, selectedId, switchMode, addDraftPoint, finishRoute, deleteRoute]);

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y — poza polami tekstowymi (tam działa cofanie przeglądarki).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable='true']"))) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undoPlans(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redoPlans(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveCalibration = (meters: number) => {
    if (calDraft.length !== 2) return;
    stopPlansCapture();
    if (setPlanCalibration(pid, { a: calDraft[0], b: calDraft[1], meters, at: Date.now() })) {
      toast.success("Zapisano skalę — długości tras są teraz w metrach");
      switchMode("select");
    }
  };

  const clearCalibration = () => {
    const prev = calibration;
    stopPlansCapture();
    setPlanCalibration(pid, null);
    if (prev) toastWithUndo("Usunięto skalę — długości wróciły do pikseli", () => setPlanCalibration(pid, prev));
  };

  const hint = mode === "route" ? "Stuknij kolejne punkty rury" : mode === "calibrate" ? "Stuknij dwa końce znanego wymiaru" : "Stuknij trasę, żeby ją zaznaczyć";

  return (
    <section aria-label={`Analiza: ${project.name}`} className="flex h-[calc(100dvh-8.5rem)] min-h-[28rem] flex-col overflow-hidden rounded-card border border-border/60 bg-card sm:h-[calc(100dvh-7rem)]" data-testid="plan-editor">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 px-1.5 py-1">
        <button type="button" onClick={onBack} className={toolBtn} aria-label="Wróć do listy analiz">
          <ArrowLeft className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Analizy</span>
        </button>
        {renaming ? (
          <form className="min-w-0 flex-1" onSubmit={(e) => { e.preventDefault(); setRenaming(false); }}>
            <input
              autoFocus defaultValue={project.name} maxLength={PLAN_NAME_MAX} aria-label="Nazwa analizy"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== project.name) renamePlan(pid, v); setRenaming(false); }}
              onKeyDown={(e) => { if (e.key === "Escape") { e.currentTarget.value = project.name; setRenaming(false); } }}
              className="h-9 w-full rounded-field border border-border bg-background px-2 font-display text-base outline-hidden focus:ring-2 focus:ring-ring"
            />
          </form>
        ) : (
          <h2 className="flex min-w-0 flex-1 items-center gap-1 px-1 font-display text-base">
            <span className="truncate">{project.name}</span>
            <button type="button" onClick={() => setRenaming(true)} className={cn(toolBtn, "h-8 min-w-8 px-1 text-muted-foreground")} aria-label="Zmień nazwę analizy">
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
          </h2>
        )}
        <button type="button" onClick={undoPlans} disabled={!undo.undo} className={toolBtn} aria-label="Cofnij" title={`Cofnij (${modShortcut("Z")})`}><Undo2 className="h-4 w-4" aria-hidden /></button>
        <button type="button" onClick={redoPlans} disabled={!undo.redo} className={toolBtn} aria-label="Ponów" title={`Ponów (${modShortcut("Y")})`}><Redo2 className="h-4 w-4" aria-hidden /></button>
        <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-border sm:block" />
        {/* Na telefonie przybliża szczypanie — pasek zostawia miejsce na nazwę analizy. */}
        <button type="button" onClick={() => canvas.current?.zoomBy(0.8)} className={cn(toolBtn, "hidden sm:inline-flex")} aria-label="Oddal"><Minus className="h-4 w-4" aria-hidden /></button>
        <button type="button" onClick={() => canvas.current?.zoomBy(1.25)} className={cn(toolBtn, "hidden sm:inline-flex")} aria-label="Przybliż"><Plus className="h-4 w-4" aria-hidden /></button>
        <button type="button" onClick={() => canvas.current?.fit()} className={toolBtn} aria-label="Dopasuj do ekranu" title="Dopasuj do ekranu (0)">
          <Maximize className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-border/60 px-1.5 py-1" role="group" aria-label="Narzędzie">
        {MODES.map(({ id, label, Icon }) => (
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => switchMode(id)}
            className={cn(toolBtn, "flex-1 sm:flex-none", mode === id && "bg-primary text-primary-foreground hover:bg-primary")}>
            <Icon className="h-4 w-4" aria-hidden />{label}
          </button>
        ))}
        <p className="ml-2 hidden truncate text-xs text-muted-foreground md:block" aria-live="polite">{hint}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative min-h-0 flex-1">
          <PlanCanvas
            ref={canvas}
            url={url}
            width={project.image.w}
            height={project.image.h}
            onTap={onTap}
            onHover={mode === "route" && draft.length >= 2 ? setHover : undefined}
            onPressStart={onPressStart}
            onPressMove={onPressMove}
            onPressEnd={onPressEnd}
            onKeyAction={onKeyAction}
            crosshair={mode !== "select"}
            cursor={mode === "select" ? "default" : "crosshair"}
            label={`Plan ${project.name}. ${hint}. Przesuwaj palcem albo strzałkami, przybliżaj dwoma palcami, kółkiem albo klawiszami plus i minus, zero dopasowuje do ekranu.`}
          >
            {(scale) => (
              <PlanOverlay
                scale={scale} routes={shownRoutes} mpp={mpp} selectedId={selectedId}
                draft={mode === "route" ? draft : null} hover={hover} draftSystem={draftSystem}
                calibration={mode === "route" ? null : calibration} calDraft={mode === "calibrate" ? calDraft : []} showHandles={mode === "select"}
              />
            )}
          </PlanCanvas>
        </div>
        <aside aria-label="Panel analizy" className="max-h-[45%] shrink-0 overflow-y-auto border-t border-border/60 lg:max-h-none lg:border-l lg:border-t-0">
          {mode === "route" && (
            <DraftSection draft={draft} mpp={mpp} system={draftSystem} onSystem={setDraftSystem} snap={snap} onSnap={setSnap}
              onUndoPoint={() => setDraft((d) => d.slice(0, -2))} onFinish={finishRoute} onCancel={() => switchMode("select")} />
          )}
          {mode !== "route" && (
            <ScaleSection mode={mode} calibration={calibration} calDraft={calDraft} mpp={mpp}
              onStart={() => switchMode("calibrate")} onSave={saveCalibration} onCancel={() => switchMode("select")} onClear={clearCalibration} />
          )}
          {mode === "select" && selected && (
            <RouteSection route={selected} mpp={mpp} onChange={(r) => { stopPlansCapture(); savePlanEntity("r", pid, r); }} onDelete={() => deleteRoute(selected.id)} />
          )}
          {mode === "select" && <RoutesList routes={routes} mpp={mpp} selectedId={selectedId} onSelect={setSelectedId} />}
        </aside>
      </div>
    </section>
  );
}
