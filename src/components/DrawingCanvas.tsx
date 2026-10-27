import { useRef, useState, useEffect, useCallback } from "react";
import { m as motion } from "framer-motion";
import { Pen, Eraser, Undo2, Trash, Save, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const COLORS = [
  "#1a1a2e", "#e74c3c", "#e67e22", "#f1c40f",
  "#2ecc71", "#3498db", "#9b59b6", "#ffffff",
];
/** Nazwy kolorów dla czytnika ekranu — w tej samej kolejności co `COLORS`. */
const COLOR_NAMES = ["granatowy", "czerwony", "pomarańczowy", "żółty", "zielony", "niebieski", "fioletowy", "biały"];

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  tool: "pen" | "eraser";
}

interface DrawingCanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dataUrl: string) => void;
  initialImage?: string | null;
}

/** Kreski (z gumką) na jednym kontekście — gumka wycina tylko kreski, bo rysujemy je na osobnej warstwie. */
function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
    ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 3 : stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      const prev = stroke.points[i - 1];
      const curr = stroke.points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }
}

/**
 * Tło (białe albo zdjęcie) i warstwa kresek w skali `scale` (eksport w większej rozdzielczości).
 * Warstwa jest osobnym płótnem, więc gumka nie ściera zdjęcia pod spodem.
 */
function compose(ctx: CanvasRenderingContext2D, width: number, height: number, bg: HTMLImageElement | null, strokes: Stroke[], scale = 1) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (bg) ctx.drawImage(bg, 0, 0, width, height);
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
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
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
    compose(ctx, canvas.width, canvas.height, bg, currentStroke ? [...strokes, currentStroke] : strokes);
    // canvasSize isn't read directly above, but changing the canvas width/height JSX attrs
    // clears its pixel buffer, so a resize must still trigger a redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize, bg, strokes, currentStroke]);

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

  function getPos(e: React.MouseEvent | React.TouchEvent): Point | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setIsDrawing(true);
    setCurrentStroke({ points: [pos], color, width: strokeWidth, tool });
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing || !currentStroke) return;
    const pos = getPos(e);
    if (!pos) return;
    setCurrentStroke((prev) => prev ? { ...prev, points: [...prev.points, pos] } : null);
  }

  function stopDrawing() {
    if (currentStroke && currentStroke.points.length > 1) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
    setIsDrawing(false);
  }

  function undo() {
    setStrokes((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    setStrokes([]);
    setCurrentStroke(null);
  }

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
    compose(exportCtx, exportCanvas.width, exportCanvas.height, bg, strokes, scale);
    const dataUrl = exportCanvas.toDataURL(bg ? "image/jpeg" : "image/png", 0.9);
    onSave(dataUrl);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-sm:max-w-[95vw] w-full max-h-[90dvh] h-full p-0 gap-0 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap bg-card">
          <div className="flex items-center gap-1">
            <ToolBtn
              active={tool === "pen"}
              onClick={() => setTool("pen")}
              icon={<Pen className="w-4 h-4" />}
              title="Ołówek"
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
              <motion.button
                key={c}
                type="button"
                aria-label={`Kolor: ${COLOR_NAMES[COLORS.indexOf(c)]}`}
                aria-pressed={color === c && tool === "pen"}
                onClick={() => { setColor(c); setTool("pen"); }}
                className={cn(
                  "pressable w-6 h-6 rounded-full border-2 transition-all",
                  color === c && tool === "pen" ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border hover:border-muted-foreground/40"
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
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
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
