import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Pen, Eraser, Undo2, Trash2, Save, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const COLORS = [
  "#1a1a2e", "#e74c3c", "#e67e22", "#f1c40f",
  "#2ecc71", "#3498db", "#9b59b6", "#ffffff",
];

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

  // Resize canvas to fit container
  useEffect(() => {
    if (!open) return;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const w = Math.min(rect.width - 2, 1200);
        const h = Math.min(rect.height - 2, 800);
        setCanvasSize({ width: Math.max(w, 300), height: Math.max(h, 200) });
      }
    };
    // Delay to allow dialog to render
    const timeout = setTimeout(updateSize, 100);
    window.addEventListener("resize", updateSize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", updateSize);
    };
  }, [open]);

  const drawAllStrokes = useCallback((ctx: CanvasRenderingContext2D) => {
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
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
  }, [strokes, currentStroke]);

  // Redraw canvas when strokes or size change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image if exists
    if (initialImage) {
      const img = new Image();
      img.src = initialImage;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawAllStrokes(ctx);
      };
    } else {
      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawAllStrokes(ctx);
    }
    // canvasSize isn't read directly above, but changing the canvas width/height JSX attrs
    // clears its pixel buffer, so a resize must still trigger a redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize, initialImage, drawAllStrokes]);

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
    // Redraw without eraser composite to get clean image
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Create a temporary canvas for export
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    // White bg
    exportCtx.fillStyle = "#ffffff";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw initial image if exists
    if (initialImage) {
      const img = new Image();
      img.src = initialImage;
      // Sync draw since image should be cached
      exportCtx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height);
    }

    // Draw all strokes
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      exportCtx.beginPath();
      exportCtx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
      exportCtx.lineWidth = stroke.tool === "eraser" ? stroke.width * 3 : stroke.width;
      exportCtx.lineCap = "round";
      exportCtx.lineJoin = "round";
      exportCtx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      exportCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        const prev = stroke.points[i - 1];
        const curr = stroke.points[i];
        exportCtx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
      }
      exportCtx.stroke();
      exportCtx.globalCompositeOperation = "source-over";
    }

    const dataUrl = exportCanvas.toDataURL("image/png");
    onSave(dataUrl);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] h-full p-0 gap-0 overflow-hidden flex flex-col">
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
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => { setColor(c); setTool("pen"); }}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
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
              icon={<Trash2 className="w-4 h-4" />}
              title="Wyczyść"
              disabled={strokes.length === 0}
              className="hover:text-destructive"
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
            className="rounded-xl shadow-lg bg-white cursor-crosshair touch-none max-w-full max-h-full"
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
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-lg transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
        disabled && "opacity-40 pointer-events-none",
        className
      )}
      title={title}
    >
      {icon}
    </motion.button>
  );
}
