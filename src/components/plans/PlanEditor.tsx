import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleDot, ClipboardList, Maximize, Minus, MousePointer2, Pencil, Plus, Redo2, Ruler, Spline, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useImageUrl } from "@/hooks/useImageUrl";
import { metersPerPixel, pickRoute, pickVertex } from "@/lib/plans/geometry";
import { PLAN_NAME_MAX, PLAN_ROUTE_POINTS_MAX, type PipeRoute, type PlanPoint, type SystemType } from "@/lib/plans/model";
import {
  clearPlansUndo, newPlanId, redoPlans, removePlanEntity, renamePlan, savePlanEntity, setPlanCalibration, setPlanColors, stopPlansCapture, undoPlans, usePlansUndo,
} from "@/lib/plans/plansStore";
import { snapAngle } from "@/lib/plans/systems";
import type { PlanData } from "@/lib/plans/yPlans";
import { toastWithUndo } from "@/lib/undoToast";
import { modShortcut } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { PlanCanvas, type PlanCanvasHandle } from "./PlanCanvas";
import { PlanOverlay } from "./PlanOverlay";
import { OcrSection, type OcrProposal, type OcrRun } from "./OcrPanel";
import { DetectSection, type DetectRun, type RouteProposal } from "./DetectPanel";
import { FittingsSection, SymbolPlaceSection, SymbolSection } from "./SymbolPanel";
import { MaterialsPanel } from "./MaterialsPanel";
import { pickSymbol, proposeFittings, type FittingProposal } from "@/lib/plans/fittings";
import type { DetectedSymbol, SymbolType } from "@/lib/plans/model";
import { imageStore } from "@/lib/imageStore";
import { interpretOcrText, OCR_SURE } from "@/lib/plans/diameters";
import { overlapRatio } from "@/lib/plans/tiles";
import { suggestDiameters } from "@/lib/plans/assign";
import type { DetectedText } from "@/lib/plans/model";
import { DraftSection, RouteSection, RoutesList, ScaleSection, type EditorMode } from "./PlanPanel";

const toolBtn = "pressable inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent coarse:h-11 coarse:min-w-11";
/** Promień trafienia trasy i punktu w pikselach EKRANU (palec ~ 10 mm). */
const HIT_ROUTE_PX = 14;
const HIT_HANDLE_PX = 18;

const MODES: { id: EditorMode; label: string; Icon: typeof Ruler }[] = [
  { id: "select", label: "Zaznacz", Icon: MousePointer2 },
  { id: "route", label: "Trasa", Icon: Spline },
  { id: "symbol", label: "Symbol", Icon: CircleDot },
  { id: "calibrate", label: "Skala", Icon: Ruler },
];
/** Promień trafienia symbolu (piksele ekranu) — symbol ma pierwszeństwo przed trasą pod nim. */
const HIT_SYMBOL_PX = 16;

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
  const [proposals, setProposals] = useState<OcrProposal[]>([]);
  const [ocrRun, setOcrRun] = useState<OcrRun>({ state: "idle" });
  const [engineCached, setEngineCached] = useState<boolean | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Propozycje tras z koloru (faza 5): pipeta, kolor, tolerancja, instalacja i wyniki — tylko w edytorze.
  const [picking, setPicking] = useState(false);
  const [detectColor, setDetectColor] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(0.25);
  const [detectSystem, setDetectSystem] = useState<SystemType>("cold");
  const [detectRun, setDetectRun] = useState<DetectRun>({ state: "idle" });
  const [routeProposals, setRouteProposals] = useState<RouteProposal[]>([]);
  // Symbole (faza 6): rodzaj i instalacja nowego symbolu, zaznaczony symbol, propozycje kształtek.
  const [symbolType, setSymbolType] = useState<SymbolType>("outlet");
  const [symbolSystem, setSymbolSystem] = useState<SystemType | undefined>(undefined);
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null);
  const [fittings, setFittings] = useState<(FittingProposal & { id: string })[]>([]);
  // Zestawienie (faza 7) zamiast panelu narzędzi; wiersz podświetla swoje trasy i symbole na planie.
  const [showSummary, setShowSummary] = useState(false);
  const [highlight, setHighlight] = useState<{ key: string; ids: string[] } | null>(null);
  const undo = usePlansUndo();
  const mpp = metersPerPixel(calibration);

  // Czy silnik OCR jest już pobrany (do komunikatu o pierwszym pobraniu). Przy wyjściu przerywamy rozpoznawanie.
  useEffect(() => {
    let on = true;
    void import("@/lib/plans/ocr/ocrClient").then((m) => m.engineReady()).then((r) => { if (on) setEngineCached(r); }).catch(() => {});
    return () => {
      on = false;
      void import("@/lib/plans/ocr/ocrClient").then((m) => m.cancelOcr()).catch(() => {});
      void import("@/lib/plans/detect/detectClient").then((m) => m.releaseDetectCache()).catch(() => {});
    };
  }, []);

  // Każda analiza ma własny stos „Cofnij”.
  useEffect(() => { clearPlansUndo(); }, [pid]);
  // Trasa usunięta (np. „Cofnij” albo drugie urządzenie) — zaznaczenie znika.
  useEffect(() => { if (selectedId && !routes.some((r) => r.id === selectedId)) setSelectedId(null); }, [routes, selectedId]);

  const shownRoutes = useMemo(
    () => (drag && selectedId ? routes.map((r) => (r.id === selectedId ? { ...r, pts: drag.pts } : r)) : routes),
    [routes, drag, selectedId],
  );
  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const selectedSymbol = plan.symbols.find((s) => s.id === selectedSymbolId) ?? null;
  useEffect(() => { if (selectedSymbolId && !plan.symbols.some((s) => s.id === selectedSymbolId)) setSelectedSymbolId(null); }, [plan.symbols, selectedSymbolId]);

  const switchMode = useCallback((m: EditorMode) => {
    setMode(m);
    setPicking(false);
    setSelectedSymbolId(null);
    // Wybór narzędzia wraca z zestawienia do panelu narzędzi.
    setShowSummary(false);
    setHighlight(null);
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

  const deleteSymbol = useCallback((id: string) => {
    stopPlansCapture();
    const removed = removePlanEntity("s", pid, id);
    if (removed) toastWithUndo("Usunięto symbol", () => savePlanEntity("s", pid, removed));
  }, [pid]);

  const onTap = useCallback((p: PlanPoint) => {
    if (picking) {
      setPicking(false);
      void import("@/lib/plans/detect/detectClient").then((m) => m.sampleColor(project, p.x, p.y)).then((hex) => {
        if (!hex) { toast.error("W tym miejscu jest tło — stuknij dokładnie w linię rury."); return; }
        setDetectColor(hex);
        const known = plan.colors.find((c) => c.hex === hex);
        if (known) setDetectSystem(known.system);
      }).catch(() => toast.error("Nie udało się odczytać koloru."));
      return;
    }
    if (mode === "route") { addDraftPoint(p); return; }
    if (mode === "calibrate") { setCalDraft((c) => (c.length >= 2 ? [p] : [...c, p])); return; }
    if (mode === "symbol") {
      const s: DetectedSymbol = { id: newPlanId("sym"), type: symbolType, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, ...(symbolSystem ? { system: symbolSystem } : {}), manual: true, verified: true, at: Date.now() };
      stopPlansCapture();
      if (!savePlanEntity("s", pid, s)) toast.error("Nie udało się dodać symbolu (limit 1000 w analizie).");
      return;
    }
    const scale = canvas.current?.view().scale ?? 1;
    const sym = pickSymbol(plan.symbols, p, HIT_SYMBOL_PX / scale);
    setSelectedSymbolId(sym);
    setSelectedId(sym ? null : pickRoute(routes, p, HIT_ROUTE_PX / scale));
  }, [mode, addDraftPoint, routes, picking, project, plan.colors, plan.symbols, symbolType, symbolSystem, pid]);

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
    if (mode === "symbol" && key === " ") { onTap(center); return true; }
    if (mode === "calibrate" && key === " ") { setCalDraft((c) => (c.length >= 2 ? [center] : [...c, center])); return true; }
    if (mode === "select" && selectedSymbolId && (key === "Delete" || key === "Backspace")) { deleteSymbol(selectedSymbolId); return true; }
    if (mode === "select" && selectedId && (key === "Delete" || key === "Backspace")) { deleteRoute(selectedId); return true; }
    return false;
  }, [mode, selectedId, selectedSymbolId, switchMode, addDraftPoint, finishRoute, deleteRoute, deleteSymbol, onTap]);

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

  async function runOcr() {
    setOcrRun({ state: "running", label: "Przygotowuję…", value: 0 });
    try {
      // Kopia robocza (lżejsza), a gdy jej bajtów tu nie ma — oryginał.
      const rec = (project.work && await imageStore.get(project.work.ref)) || await imageStore.get(project.image.ref);
      if (!rec) throw new Error("Obrazu planu nie ma na tym urządzeniu.");
      const { recognizePlan } = await import("@/lib/plans/ocr/ocrClient");
      const LABEL = { download: "Pobieram silnik OCR…", start: "Uruchamiam silnik OCR…", recognize: "Odczytuję opisy" } as const;
      const lines = await recognizePlan(new Blob([rec.bytes], { type: rec.type }), project.image.w, (p) =>
        setOcrRun({ state: "running", label: p.detail ? `${LABEL[p.stage]} — ${p.detail}` : LABEL[p.stage], value: p.value }));
      setEngineCached(true);
      const saved = plan.texts;
      // Tylko napisy, które coś znaczą dla zestawienia, i nie te już zatwierdzone w tym samym miejscu.
      const next = lines
        .filter((l) => interpretOcrText(l.raw))
        .map((l): OcrProposal => ({ id: newPlanId("text"), raw: l.raw, text: l.raw, box: [l.box.x, l.box.y, l.box.w, l.box.h], confidence: l.confidence }))
        .filter((p) => !saved.some((t) => overlapRatio(rect(t.box), rect(p.box)) > 0.5));
      setProposals(next);
      setOcrRun({ state: "idle" });
      toast.success(next.length ? `Odczytano ${next.length} opisów do sprawdzenia` : "Nie znaleziono średnic ani oznaczeń — sprawdź, czy plan jest wyraźny");
    } catch (e) {
      if ((e as Error).name === "OcrCancelled" || (e as Error).message.startsWith("Przerwano")) { setOcrRun({ state: "idle" }); return; }
      setOcrRun({ state: "error", message: (e as Error).message || "Rozpoznawanie się nie udało." });
    }
  }

  const cancelOcrRun = () => { void import("@/lib/plans/ocr/ocrClient").then((m) => m.cancelOcr()); setOcrRun({ state: "idle" }); };

  const toText = (p: OcrProposal): DetectedText => ({ id: p.id, raw: p.raw, text: p.text.trim(), box: p.box, confidence: p.confidence, verified: true, at: Date.now() });
  const acceptProposal = (p: OcrProposal) => {
    stopPlansCapture();
    if (savePlanEntity("t", pid, toText(p))) setProposals((list) => list.filter((x) => x.id !== p.id));
  };
  const acceptSure = () => {
    stopPlansCapture();
    const sure = proposals.filter((p) => p.confidence >= OCR_SURE && interpretOcrText(p.text));
    for (const p of sure) savePlanEntity("t", pid, toText(p));
    setProposals((list) => list.filter((x) => !sure.includes(x)));
  };
  const removeText = (id: string) => {
    stopPlansCapture();
    const removed = removePlanEntity("t", pid, id);
    if (removed) toastWithUndo("Usunięto opis", () => savePlanEntity("t", pid, removed));
  };

  async function runDetect() {
    if (!detectColor) return;
    setDetectRun({ state: "running" });
    try {
      const { detectRoutes } = await import("@/lib/plans/detect/detectClient");
      const found = await detectRoutes(project, plan.texts, detectColor, tolerance);
      setRouteProposals(found.map((l) => ({ id: newPlanId("route"), pts: l.pts, confidence: l.confidence })));
      setDetectRun({ state: "idle" });
      if (!found.length) toast("Nie znaleziono linii w tym kolorze — zwiększ tolerancję albo wskaż kolor jeszcze raz.");
    } catch (e) {
      setDetectRun({ state: "error", message: (e as Error).message || "Wyszukiwanie tras się nie udało." });
    }
  }

  /** Dodaje propozycje jako trasy „do weryfikacji” i zapamiętuje kolor warstwy → instalacja. */
  const addProposals = (list: readonly RouteProposal[]) => {
    stopPlansCapture();
    let added = 0;
    for (const p of list) {
      const route: PipeRoute = { id: p.id, system: detectSystem, pts: p.pts, source: "auto", confidence: p.confidence, verified: false, at: Date.now() + added };
      if (savePlanEntity("r", pid, route)) added++;
    }
    if (detectColor) setPlanColors(pid, [{ hex: detectColor, system: detectSystem }, ...plan.colors.filter((c) => c.hex !== detectColor)]);
    setRouteProposals((cur) => cur.filter((x) => !list.includes(x)));
    if (added < list.length) toast.error("Część tras nie zmieściła się (limit 500 w analizie).");
  };

  const proposeFittingsNow = () => {
    const scale = canvas.current?.view().scale ?? 1;
    const found = proposeFittings(routes, plan.symbols, Math.max(6, HIT_SYMBOL_PX / scale));
    setFittings(found.map((f) => ({ ...f, id: newPlanId("sym") })));
    if (!found.length) toast("Brak nowych kolan ani trójników — trasy są proste albo symbole już stoją.");
  };
  const addFittings = (list: readonly (FittingProposal & { id: string })[]) => {
    stopPlansCapture();
    for (const f of list) savePlanEntity("s", pid, { id: f.id, type: f.type, x: f.x, y: f.y, system: f.system, confidence: f.confidence, manual: false, verified: false, at: Date.now() });
    setFittings((cur) => cur.filter((x) => !list.includes(x)));
  };

  const suggestions = useMemo(
    () => (selected ? suggestDiameters(selected, plan.texts, Math.max(40, Math.hypot(project.image.w, project.image.h) * 0.03)) : []),
    [selected, plan.texts, project.image.w, project.image.h],
  );

  const hint = picking ? "Stuknij linię rury, żeby pobrać jej kolor" : mode === "symbol" ? "Stuknij miejsce symbolu" : mode === "route" ? "Stuknij kolejne punkty rury" : mode === "calibrate" ? "Stuknij dwa końce znanego wymiaru" : "Stuknij trasę, żeby ją zaznaczyć";

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
        <p className="ml-2 hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block" aria-live="polite">{hint}</p>
        <button type="button" aria-pressed={showSummary} onClick={() => { setShowSummary((v) => !v); setHighlight(null); }}
          className={cn(toolBtn, "ml-auto shrink-0", showSummary && "bg-primary text-primary-foreground hover:bg-primary")}>
          <ClipboardList className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Zestawienie</span>
        </button>
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

            cursor={picking ? "copy" : mode === "select" ? "default" : "crosshair"}
            label={`Plan ${project.name}. ${hint}. Przesuwaj palcem albo strzałkami, przybliżaj dwoma palcami, kółkiem albo klawiszami plus i minus, zero dopasowuje do ekranu.`}
          >
            {(scale) => (
              <PlanOverlay
                scale={scale} routes={shownRoutes} mpp={mpp} selectedId={selectedId}
                draft={mode === "route" ? draft : null} hover={hover} draftSystem={draftSystem}
                calibration={mode === "route" ? null : calibration} calDraft={mode === "calibrate" ? calDraft : []} showHandles={mode === "select"}
                texts={plan.texts} proposals={proposals} focusId={focusId}
                routeProposals={routeProposals} proposalColor={detectColor}
                symbols={plan.symbols} selectedSymbolId={selectedSymbolId} fittings={fittings} highlightIds={highlight?.ids ?? null}
              />
            )}
          </PlanCanvas>
        </div>
        <aside aria-label="Panel analizy" className="max-h-[45%] shrink-0 overflow-y-auto border-t border-border/60 lg:max-h-none lg:border-l lg:border-t-0">
          {showSummary ? <MaterialsPanel plan={plan} highlight={highlight?.key ?? null} onHighlight={(key, ids) => setHighlight(key ? { key, ids } : null)} /> : <>
          {mode === "route" && (
            <DraftSection draft={draft} mpp={mpp} system={draftSystem} onSystem={setDraftSystem} snap={snap} onSnap={setSnap}
              onUndoPoint={() => setDraft((d) => d.slice(0, -2))} onFinish={finishRoute} onCancel={() => switchMode("select")} />
          )}
          {mode !== "route" && (
            <ScaleSection mode={mode} calibration={calibration} calDraft={calDraft} mpp={mpp}
              onStart={() => switchMode("calibrate")} onSave={saveCalibration} onCancel={() => switchMode("select")} onClear={clearCalibration} />
          )}
          {mode === "symbol" && <SymbolPlaceSection type={symbolType} onType={setSymbolType} system={symbolSystem} onSystem={setSymbolSystem} />}
          {mode === "select" && selectedSymbol && (
            <SymbolSection symbol={selectedSymbol} onChange={(s) => { stopPlansCapture(); savePlanEntity("s", pid, s); }} onDelete={() => deleteSymbol(selectedSymbol.id)} />
          )}
          {mode === "select" && selected && (
            <RouteSection route={selected} mpp={mpp} onChange={(r) => { stopPlansCapture(); savePlanEntity("r", pid, r); }} onDelete={() => deleteRoute(selected.id)}
              suggestions={suggestions} onFocusText={setFocusId} />
          )}
          {mode === "select" && (
            <DetectSection picking={picking} onPick={setPicking} color={detectColor} tolerance={tolerance} onTolerance={setTolerance}
              system={detectSystem} onSystem={setDetectSystem} run={detectRun} proposals={routeProposals} mpp={mpp} focusId={focusId} onFocus={setFocusId}
              onDetect={() => void runDetect()} onAdd={(p) => addProposals([p])} onReject={(id) => setRouteProposals((l) => l.filter((p) => p.id !== id))}
              onAddAll={() => addProposals(routeProposals)} />
          )}
          {mode === "select" && (
            <OcrSection run={ocrRun} engineCached={engineCached} proposals={proposals} texts={plan.texts} focusId={focusId} onFocus={setFocusId}
              onRun={() => void runOcr()} onCancel={cancelOcrRun} onEdit={(id, text) => setProposals((l) => l.map((p) => (p.id === id ? { ...p, text } : p)))}
              onAccept={acceptProposal} onReject={(id) => setProposals((l) => l.filter((p) => p.id !== id))} onAcceptSure={acceptSure} onRemoveText={removeText} />
          )}
          {(mode === "select" || mode === "symbol") && (
            <FittingsSection proposals={fittings} symbols={plan.symbols} routesCount={routes.length} selectedId={selectedSymbolId} focusId={focusId} onFocus={setFocusId}
              onPropose={proposeFittingsNow} onAdd={(f) => addFittings([f])} onReject={(id) => setFittings((l) => l.filter((f) => f.id !== id))}
              onAddAll={() => addFittings(fittings)} onSelect={(id) => { if (mode !== "select") switchMode("select"); setSelectedId(null); setSelectedSymbolId(id); }} />
          )}
          {mode === "select" && <RoutesList routes={routes} mpp={mpp} selectedId={selectedId} onSelect={setSelectedId} />}
          </>}
        </aside>
      </div>
    </section>
  );
}

const rect = (b: readonly [number, number, number, number]) => ({ x: b[0], y: b[1], w: b[2], h: b[3] });
