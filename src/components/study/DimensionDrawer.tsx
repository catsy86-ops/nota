import { useEffect, useRef, useState } from "react";
import { Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { toast } from "sonner";
import type { Dimension } from "@/lib/study/dimensions";

interface DimensionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  dimensions: Dimension[];
  onSave: (dimensions: Dimension[]) => void;
}

export function DimensionDrawer({ open, onOpenChange, imageUrl, dimensions, onSave }: DimensionDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [currentDimensions, setCurrentDimensions] = useState(dimensions);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!open || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      redrawDimensions(ctx, img, currentDimensions);
    };
    img.src = imageUrl;
  }, [open, imageUrl, currentDimensions]);

  function redrawDimensions(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dims: Dimension[]) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(img, 0, 0);

    dims.forEach((dim) => {
      drawDimension(ctx, dim);
    });
  }

  function drawDimension(ctx: CanvasRenderingContext2D, dim: Dimension) {
    const [x1, y1] = dim.from;
    const [x2, y2] = dim.to;

    // Linia
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Punkty
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(x1 - 4, y1 - 4, 8, 8);
    ctx.fillRect(x2 - 4, y2 - 4, 8, 8);

    // Tekst
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    ctx.fillStyle = "#000";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(dim.text, midX, midY - 10);
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPoint([x, y]);
    setDrawing(true);
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !startPoint || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      redrawDimensions(ctx, img, currentDimensions);

      // Rysuj linię tymczasową
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(startPoint[0], startPoint[1]);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    img.src = imageUrl;

    setEndPoint([x, y]);
  }

  function handleCanvasMouseUp() {
    if (!drawing || !startPoint || !endPoint) return;
    setDrawing(false);
    setShowTextInput(true);
  }

  function addDimension() {
    if (!startPoint || !endPoint || !textInput.trim()) return;

    const newDim: Dimension = {
      from: startPoint,
      to: endPoint,
      text: textInput.trim(),
    };

    const updated = [...currentDimensions, newDim];
    setCurrentDimensions(updated);
    setTextInput("");
    setShowTextInput(false);
    setStartPoint(null);
    setEndPoint(null);
    toast.success("Wymiar dodany");
  }

  function removeDimension(index: number) {
    const updated = currentDimensions.filter((_, i) => i !== index);
    setCurrentDimensions(updated);
  }

  function save() {
    onSave(currentDimensions);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-2xl" data-testid="dimension-drawer">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="font-display text-lg">Wymiary na zdjęciu</DialogTitle>
          <DialogDescription className="text-xs">Kliknij dwa punkty, wpisz wymiar. Powtórz dla więcej wymiarów (B3.3)</DialogDescription>
        </div>

        <div className="space-y-3 px-5 py-4">
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="w-full border border-border rounded-card bg-black cursor-crosshair"
            style={{ maxHeight: "400px", objectFit: "contain" }}
          />

          {showTextInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="np. 120 cm, 5m"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addDimension();
                }}
                className="flex-1 rounded-field border border-input bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <Button size="sm" onClick={addDimension} className="coarse:h-10">
                <Check className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}

          {currentDimensions.length > 0 && (
            <ul className="space-y-1">
              {currentDimensions.map((dim, idx) => (
                <li key={idx} className="flex items-center justify-between rounded-card bg-muted px-3 py-2 text-sm">
                  <span>{dim.text}</span>
                  <button
                    type="button"
                    onClick={() => removeDimension(idx)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">
            <X className="mr-1 h-4 w-4" aria-hidden />
            Zamknij
          </Button>
          <Button type="button" onClick={save} className="coarse:h-11">
            Zapisz wymiary
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
