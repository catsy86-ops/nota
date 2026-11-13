import { useRef, useState, useEffect, useCallback } from "react";
import { Pen, Pencil, Highlighter, Grid3x3, Eraser, Undo2, Trash, Save, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { toastWithUndo } from "@/lib/undoToast";

const COLORS = [
  "#1a1a2e", "#e74c3c", "#e67e22", "#f1c40f",
  "#2ecc71", "#3498db", "#9b59b6", "#ffffff",
];
/** Nazwy kolorów dla czytnika ekranu — w tej samej kolejności co `COLORS`. */
const COLOR_NAMES = ["granatowy", "czerwony", "pomarańczowy", "żółty", "zielony", "niebieski", "fioletowy", "biały"];

interface Point {
  x: number;
  y: number;
  /** Nacisk rysika 0–1 (dla myszy i palca stałe 0,5 — wtedy grubość się nie zmienia). */
  p: number;
}

type Tool = "pen" | "pencil" | "marker" | "eraser";

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  tool: Tool;
  /** Tylko rysik niesie prawdziwy nacisk; mysz i palec rysują stałą grubością. */
  pressure: boolean;
}

/** Plan Notatek 4.4: zakreślacz jest szeroki i półprzezroczysty, ołówek cieńszy i lekko kryjący. */
const MARKER_FACTOR = 4;
const PENCIL_FACTOR = 0.7;
const GRID_STEP = 24;

interface DrawingCanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dataUrl: string) => void;
  initialImage?: string | null;
}

/** Grubość odcinka pióra: przy rysiku zależy od nacisku (0,35–1,65 × ustawiona), inaczej stała. */
function penWidth(stroke: Stroke, p: number) {
  return stroke.pressure ? stroke.width * (0.35 + 1.3 * p) : stroke.width;
}

/** Kreski (z gumką) na jednym kontekście — gumka wycina tylko kreski, bo rysujemy je na osobnej warstwie. */
function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const stroke of strokes) {
    const pts = stroke.points;
    if (pts.length < 2) continue;
    ctx.lineCap = stroke.tool === "marker" ? "butt" : "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";

    if (stroke.tool === "pen" && stroke.pressure) {
      // Zmienna grubość: odcinek po odcinku, każdy ze średnią nacisku końców.
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        ctx.beginPath();
        ctx.lineWidth = penWidth(stroke, (prev.p + curr.p) / 2);
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
    } else {
      // Jedna ścieżka, żeby półprzezroczysta kreska nie ciemniała w miejscach przecięcia ze sobą.
      ctx.globalAlpha = stroke.tool === "marker" ? 0.35 : stroke.tool === "pencil" ? 0.75 : 1;
      ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 3
        : stroke.tool === "marker" ? stroke.width * MARKER_FACTOR
        : stroke.tool === "pencil" ? stroke.width * PENCIL_FACTOR
        : stroke.width;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
  }
}

/** Kratka zeszytu pod rysunkiem (tylko na białym tle, nie na zdjęciu). */
function paintGrid(ctx: CanvasRenderingContext2D, width: number, height: number, scale: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(90, 120, 170, 0.28)";
  ctx.lineWidth = Math.max(1, scale);
  ctx.beginPath();
  const step = GRID_STEP * scale;
  for (let x = step; x < width; x += step) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, height); }
  for (let y = step; y < height; y += step) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(width, Math.round(y) + 0.5); }
  ctx.stroke();
  ctx.restore();
}

/**
 * Tło (białe albo zdjęcie) i warstwa kresek w skali `scale` (eksport w większej rozdzielczości).
 * Warstwa jest osobnym płótnem, więc gumka nie ściera zdjęcia pod spodem.
 */
function compose(ctx: CanvasRenderingContext2D, width: number, height: number, bg: HTMLImageElement | null, strokes: Stroke[], scale = 1, grid = false) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (bg) ctx.drawImage(bg, 0, 0, width, height);
  else if (grid) paintGrid(ctx, width, height, scale);
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const lctx = layer.getContext("2d");
  if (!lctx) return;
  lctx.scale(scale, scale);
  paintStrokes(lctx, strokes);
  ctx.drawImage(layer, 0, 0);
}

/** Najdłuższy bok eksportu rysunku na zdjęciu — zdjęcia w dzienniku i tak są zmniejszane. */
const PHOTO_EXPORT_MAX = 1600;

export function DrawingCanvas({ open, onOpenChange, onSave, initialImage }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [grid, setGrid] = useState(false);
  /** Aktualna kreska poza stanem Reacta: kilka zdarzeń w jednej klatce nie gubi punktów. */
  const liveRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 });
  /** Zdjęcie tła (rysowanie po zdjęciu); `null` = białe tło albo jeszcze się wczytuje. */
  const [bg, setBg] = useState<HTMLImageElement | null>(null);

  // Tło wczytywane raz na otwarcie, nie przy każdej kresce.
  useEffect(() => {
    setBg(null);
    if (!open || !initialImage) return;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive) setBg(img); };
    img.src = initialImage;
    return () => { alive = false; };
  }, [open, initialImage]);

  // Resize canvas to fit container; przy zdjęciu — w jego proporcjach, bez rozciągania.
  useEffect(() => {
    if (!open) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const maxW = Math.max(Math.min(rect.width - 2, 1200), 300);
        const maxH = Math.max(Math.min(rect.height - 2, 800), 200);
        if (bg && bg.naturalWidth > 0 && bg.naturalHeight > 0) {
          const k = Math.min(maxW / bg.naturalWidth, maxH / bg.naturalHeight);
          setCanvasSize({ width: Math.round(bg.naturalWidth * k), height: Math.round(bg.naturalHeight * k) });
        } else {
          setCanvasSize({ width: maxW, height: maxH });
        }
      }
    };
    // Delay to allow dialog to render
    const timeout = setTimeout(updateSize, 100);
    window.addEventListener("resize", updateSize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", updateSize);
    };
  }, [open, bg]);

  // Redraw canvas when strokes or size change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    compose(ctx, canvas.width, canvas.height, bg, currentStroke ? [...strokes, currentStroke] : strokes, 1, grid);
    // canvasSize isn't read directly above, but changing the canvas width/height JSX attrs
    // clears its pixel buffer, so a resize must still trigger a redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize, bg, strokes, currentStroke, grid]);

  useEffect(() => {
    if (open) redraw();
  }, [redraw, open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStrokes([]);
      setCurrentStroke(null);
      setTool("pen");
      setColor(COLORS[0]);
      setStrokeWidth(3);
    }
  }, [open]);

  function toPoint(e: { clientX: number; clientY: number; pressure: number }): Point | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
      p: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  function startDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    // Tylko główny wskaźnik: drugi palec (np. dłoń) nie zaczyna drugiej kreski. Lewy przycisk myszy.
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    const pos = toPoint(e);
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke: Stroke = { points: [pos], color, width: strokeWidth, tool, pressure: e.pointerType === "pen" };
    liveRef.current = stroke;
    setCurrentStroke(stroke);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    const live = liveRef.current;
    if (!live || !e.isPrimary) return;
    e.preventDefault();
    // `getCoalescedEvents` oddaje wszystkie próbki rysika między klatkami — gładsza linia przy szybkim ruchu.
    const events = e.nativeEvent.getCoalescedEvents?.();
    const samples = events && events.length > 0 ? events : [e.nativeEvent];
    const added = samples.map((smp) => toPoint(smp)).filter((pt): pt is Point => pt !== null);
    if (added.length === 0) return;
    const next = { ...live, points: [...live.points, ...added] };
    liveRef.current = next;
    setCurrentStroke(next);
  }

  function stopDrawing() {
    const live = liveRef.current;
    liveRef.current = null;
    if (live && live.points.length > 1) setStrokes((prev) => [...prev, live]);
    setCurrentStroke(null);
  }

  function undo() {
    setStrokes((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    const before = strokes;
    setStrokes([]);
    setCurrentStroke(null);
    // 5.10 (Notatki 1.3): wyczyszczenie całego rysunku jednym stuknięciem da się cofnąć.
    if (before.length > 0) toastWithUndo("Wyczyszczono rysunek", () => setStrokes(before), { id: "drawing-clear" });
  }

  // 5.10: Esc, klik w tło i „×” przy niezapisanych kreskach nie zamykają po cichu — pytają.
  const [askDiscard, setAskDiscard] = useState(false);
  const requestClose = (next: boolean) => {
    if (next) { onOpenChange(true); return; }
    if (strokes.length > 0) { setAskDiscard(true); return; }
    onOpenChange(false);
  };
  const guardOutside = (e: Event) => {
    // Klik w toast („Cofnij” po „Wyczyść”) nie jest wyjściem z płótna.
    if ((e.target as Element | null)?.closest?.("[data-sonner-toaster]")) return;
    if (strokes.length > 0) { e.preventDefault(); setAskDiscard(true); }
  };

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Rysunek na zdjęciu — w rozdzielczości zdjęcia (do PHOTO_EXPORT_MAX), kreski przeskalowane.
    const scale = bg ? Math.max(1, Math.min(PHOTO_EXPORT_MAX / Math.max(canvas.width, canvas.height), bg.naturalWidth / canvas.width)) : 1;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.round(canvas.width * scale);
    exportCanvas.height = Math.round(canvas.height * scale);
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;
    compose(exportCtx, exportCanvas.width, exportCanvas.height, bg, strokes, scale, grid);
    const dataUrl = exportCanvas.toDataURL(bg ? "image/jpeg" : "image/png", 0.9);
    onSave(dataUrl);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent onEscapeKeyDown={guardOutside} onInteractOutside={guardOutside}
        className="max-w-[95vw] max-sm:max-w-[95vw] w-full max-h-[90dvh] h-full p-0 gap-0 overflow-hidden flex flex-col">
        {askDiscard && (
          <div role="alertdialog" aria-label="Niezapisany rysunek" className="flex flex-wrap items-center gap-2 border-b border-warning/50 bg-warning/10 px-3 py-2 text-sm">
            <span className="flex-1 min-w-[12rem]">Rysunek nie jest zapisany.</span>
            <Button size="sm" onClick={() => { setAskDiscard(false); handleSave(); }}>Zapisz rysunek</Button>
            <Button size="sm" variant="outline" onClick={() => { setAskDiscard(false); setStrokes([]); onOpenChange(false); }}>Porzuć</Button>
            <Button size="sm" variant="ghost" autoFocus onClick={() => setAskDiscard(false)}>Rysuj dalej</Button>
          </div>
        )}
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-border flex-nowrap overflow-x-auto bg-card [&>*]:shrink-0">
          <div className="flex items-center gap-1">
            <ToolBtn
              active={tool === "pen"}
              onClick={() => setTool("pen")}
              icon={<Pen className="w-4 h-4" />}
              title="Długopis"
            />
            <ToolBtn
              active={tool === "pencil"}
              onClick={() => setTool("pencil")}
              icon={<Pencil className="w-4 h-4" />}
              title="Ołówek"
            />
            <ToolBtn
              active={tool === "marker"}
              onClick={() => setTool("marker")}
              icon={<Highlighter className="w-4 h-4" />}
              title="Zakreślacz"
            />
            <ToolBtn
              active={tool === "eraser"}
              onClick={() => setTool("eraser")}
              icon={<Eraser className="w-4 h-4" />}
              title="Gumka"
            />
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Kolor: ${COLOR_NAMES[COLORS.indexOf(c)]}`}
                aria-pressed={color === c && tool !== "eraser"}
                onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
                className={cn(
                  "pressable w-6 h-6 rounded-full border-2 transition-all",
                  color === c && tool !== "eraser" ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border hover:border-muted-foreground/40"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Stroke width */}
          <div className="flex items-center gap-2 min-w-[120px]">
            <Minus className="w-3 h-3 text-muted-foreground" />
            <Slider
              value={[strokeWidth]}
              onValueChange={([v]) => setStrokeWidth(v)}
              min={1}
              max={20}
              step={1}
              className="w-20"
            />
            <Plus className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground w-6 text-center">{strokeWidth}</span>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <ToolBtn
              active={grid}
              onClick={() => setGrid((g) => !g)}
              icon={<Grid3x3 className="w-4 h-4" />}
              title="Kratka"
              disabled={!!bg}
            />
            <ToolBtn
              onClick={undo}
              icon={<Undo2 className="w-4 h-4" />}
              title="Cofnij"
              disabled={strokes.length === 0}
            />
            <ToolBtn
              onClick={clearAll}
              icon={<Trash className="w-4 h-4" />}
              title="Wyczyść"
              disabled={strokes.length === 0}
              className="hover:text-destructive-ink"
            />
          </div>

          <div className="flex-1" />

          <Button size="sm" onClick={handleSave} className="gap-1.5" disabled={strokes.length === 0}>
            <Save className="w-4 h-4" />
            Zapisz rysunek
          </Button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center bg-muted/30 overflow-auto p-2 min-h-0">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="rounded-card shadow-sm bg-white cursor-crosshair touch-none max-w-full max-h-full"
            style={{ imageRendering: "auto" }}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolBtn({ icon, onClick, title, active, disabled, className }: {
  icon: React.ReactNode; onClick: () => void; title: string; active?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "pressable p-2 rounded-field transition-colors",
        active ? "bg-primary/10 text-primary-ink" : "text-muted-foreground hover:bg-muted",
        disabled && "opacity-40 pointer-events-none",
        className
      )}
      title={title}
    >
      {icon}
    </button>
  );
}
