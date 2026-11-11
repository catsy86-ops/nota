import { useEffect, useRef, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { DIMENSION_MIN_LENGTH, DIMENSION_TEXT_MAX, MAX_DIMENSIONS_PER_IMAGE, type Dimension } from "@/lib/study/dimensions";

type Pt = [number, number];

/** Najdłuższy bok płótna w pikselach — zdjęcia z aparatu są większe, a podgląd i tak mieści się w oknie. */
const CANVAS_MAX = 1600;
/** Ruch krótszy niż tyle pikseli ekranu to stuknięcie (punkt po punkcie), dłuższy — przeciągnięcie. */
const TAP_SLOP_PX = 8;

/**
 * B3.3 Miarka: linie z opisem na zdjęciu. Dwa sposoby dodania: przeciągnięcie palcem od punktu do punktu albo
 * dwa stuknięcia (pierwszy i drugi koniec) — drugi nie wymaga przeciągania. Współrzędne są względne (0–1),
 * dane zostają przy zdjęciu, oryginał się nie zmienia.
 */
export function DimensionDrawer({ open, onOpenChange, imageUrl, dimensions, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  dimensions: readonly Dimension[];
  onSave: (dimensions: Dimension[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [list, setList] = useState<Dimension[]>([...dimensions]);
  /** Pierwszy koniec (stuknięcie) albo początek przeciągania. */
  const [start, setStart] = useState<Pt | null>(null);
  /** Bieżący koniec w trakcie przeciągania. */
  const [live, setLive] = useState<Pt | null>(null);
  /** Linia narysowana, czeka na opis. */
  const [pending, setPending] = useState<{ from: Pt; to: Pt } | null>(null);
  const [text, setText] = useState("");
  const down = useRef<{ x: number; y: number; at: Pt } | null>(null);

  // Każde otwarcie zaczyna od zapisanych wymiarów. Tylko `open` jest zależnością: rodzic przekazuje nową tablicę
  // przy każdym renderze i wyzerowałby rozpoczętą pracę.
  const saved = useRef(dimensions);
  saved.current = dimensions;
  useEffect(() => {
    if (!open) return;
    setList([...saved.current]);
    setStart(null); setLive(null); setPending(null); setText("");
  }, [open]);

  // Zdjęcie ładujemy raz, nie przy każdym ruchu palca.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const el = new Image();
    el.onload = () => { if (alive) setImg(el); };
    el.src = imageUrl;
    return () => { alive = false; setImg(null); };
  }, [open, imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !img) return;
    const scale = Math.min(1, CANVAS_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.drawImage(img, 0, 0, w, h);
    const unit = w / 360; // grubość linii i pismo rosną razem z płótnem
    const line = (a: Pt, b: Pt, color: string, dashed = false) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2.5 * unit; ctx.setLineDash(dashed ? [8 * unit, 6 * unit] : []);
      ctx.beginPath(); ctx.moveTo(a[0] * w, a[1] * h); ctx.lineTo(b[0] * w, b[1] * h); ctx.stroke(); ctx.setLineDash([]);
      for (const p of [a, b]) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0] * w, p[1] * h, 4 * unit, 0, Math.PI * 2); ctx.fill(); }
    };
    for (const d of list) {
      line(d.from, d.to, "#f59e0b");
      // Opis na jasnej tabliczce, żeby czytało się na każdym tle.
      ctx.font = `600 ${13 * unit}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const mx = ((d.from[0] + d.to[0]) / 2) * w, my = ((d.from[1] + d.to[1]) / 2) * h;
      const tw = ctx.measureText(d.text).width + 10 * unit;
      ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(mx - tw / 2, my - 11 * unit, tw, 22 * unit);
      ctx.fillStyle = "#111"; ctx.fillText(d.text, mx, my);
    }
    if (pending) line(pending.from, pending.to, "#ef4444");
    else if (start && live) line(start, live, "#ef4444", true);
    else if (start) { ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(start[0] * w, start[1] * h, 6 * unit, 0, Math.PI * 2); ctx.fill(); }
  }, [img, list, start, live, pending]);

  function pointOf(e: React.PointerEvent<HTMLCanvasElement>): Pt {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
  }

  function finish(from: Pt, to: Pt) {
    setStart(null); setLive(null);
    if (Math.hypot(to[0] - from[0], to[1] - from[1]) < DIMENSION_MIN_LENGTH) return;
    setPending({ from, to });
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (pending || list.length >= MAX_DIMENSIONS_PER_IMAGE) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    down.current = { x: e.clientX, y: e.clientY, at: pointOf(e) };
    if (start) setLive(pointOf(e));
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = down.current;
    if (!d) return;
    if (!start && Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP_PX) setStart(d.at);
    if (start || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP_PX) setLive(pointOf(e));
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = down.current;
    down.current = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP_PX;
    const here = pointOf(e);
    if (moved) { finish(start ?? d.at, here); return; }
    // Stuknięcie: pierwsze ustawia początek, drugie kończy linię.
    if (start) finish(start, here); else setStart(here);
  }

  function addDimension() {
    const label = text.replace(/\s+/g, " ").trim();
    if (!pending || !label) return;
    setList((l) => [...l, { from: pending.from, to: pending.to, text: label }]);
    setPending(null); setText("");
  }

  function cancelPending() { setPending(null); setStart(null); setLive(null); setText(""); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-2xl" data-testid="dimension-drawer">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="font-display text-lg">Wymiary na zdjęciu</DialogTitle>
          <DialogDescription className="text-xs">Przeciągnij palcem od punktu do punktu albo stuknij dwa końce, potem wpisz wymiar. Zdjęcie zostaje bez zmian.</DialogDescription>
        </div>

        <div className="space-y-3 px-5 py-4">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Zdjęcie z wymiarami. Zaznacz dwa punkty, aby dodać wymiar."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => { down.current = null; }}
            data-testid="dimension-canvas"
            className="max-h-[50dvh] w-full cursor-crosshair touch-none select-none rounded-card border border-border bg-muted object-contain"
          />

          {pending && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addDimension(); }} aria-label="Opis wymiaru">
              <input
                autoFocus
                value={text}
                maxLength={DIMENSION_TEXT_MAX}
                onChange={(e) => setText(e.target.value)}
                aria-label="Wymiar"
                placeholder="np. 35 cm od narożnika"
                className="min-w-0 flex-1 rounded-field border border-input bg-background px-3 py-2 text-base outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
              />
              <Button type="submit" size="sm" disabled={!text.trim()} className="coarse:h-11" aria-label="Dodaj wymiar"><Check className="h-4 w-4" aria-hidden /></Button>
              <Button type="button" size="sm" variant="ghost" onClick={cancelPending} className="coarse:h-11">Anuluj</Button>
            </form>
          )}
          {/* Linia stała (nie pojawia się i znika): zmiana wysokości okna między dwoma stuknięciami przesuwałaby płótno. */}
          <p className="ui-hint min-h-5" role="status" data-testid="dimension-hint">
            {pending ? "" : list.length >= MAX_DIMENSIONS_PER_IMAGE ? `Najwięcej ${MAX_DIMENSIONS_PER_IMAGE} wymiarów na zdjęciu.` : start ? "Stuknij drugi koniec wymiaru." : "Przeciągnij albo stuknij pierwszy koniec."}
          </p>

          {list.length > 0 && (
            <ul className="space-y-1" aria-label="Wymiary na zdjęciu">
              {list.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-card bg-muted px-3 py-1.5 text-sm" data-testid="dimension-item">
                  <span className="min-w-0 truncate">{d.text}</span>
                  <button type="button" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label={`Usuń wymiar ${d.text}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground coarse:h-11 coarse:w-11">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">Zamknij</Button>
          <Button type="button" onClick={() => { onSave(list); onOpenChange(false); }} className="coarse:h-11">Zapisz wymiary</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
