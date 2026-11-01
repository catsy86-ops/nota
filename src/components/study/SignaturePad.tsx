import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

/** Atrament: granatowy długopis, jak na papierowym protokole. Kartka pola jest biała w obu motywach. */
const INK = "#1f2a44";
const PEN_WIDTH = 2.4;
/** Margines wokół kresek w eksporcie (px płótna). */
const EXPORT_PAD = 12;

type Point = { x: number; y: number; p: number };

export interface SignaturePadHandle {
  /** PNG z przezroczystym tłem, przycięty do kresek; `null` = nic nie narysowano. */
  toBlob(): Promise<Blob | null>;
  clear(): void;
}

/**
 * P2.4: pole podpisu palcem, rysikiem albo myszą. Na płótnie są tylko kreski — linia podpisu i „×”
 * są warstwą DOM, więc nie trafiają do obrazu. Nacisk rysika pogrubia kreskę, palec i mysz piszą
 * stałą grubością. Płótno w rozdzielczości ekranu (`devicePixelRatio`), żeby podpis nie był rozmyty.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { onChange: (empty: boolean) => void; label: string }>(
  function SignaturePad({ onChange, label }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokes = useRef<Point[][]>([]);
    const drawing = useRef<Point[] | null>(null);

    const ctx = () => canvasRef.current?.getContext("2d") ?? null;

    const paint = useCallback(() => {
      const c = canvasRef.current;
      const g = ctx();
      if (!c || !g) return;
      const dpr = c.width / c.clientWidth || 1;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.strokeStyle = INK;
      g.fillStyle = INK;
      g.lineCap = "round";
      g.lineJoin = "round";
      for (const s of strokes.current) {
        if (s.length === 1) {
          g.beginPath();
          g.arc(s[0].x, s[0].y, PEN_WIDTH * s[0].p * 0.6, 0, Math.PI * 2);
          g.fill();
          continue;
        }
        for (let i = 1; i < s.length; i++) {
          const a = s[i - 1], b = s[i];
          g.lineWidth = PEN_WIDTH * (a.p + b.p) / 2;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
        }
      }
    }, []);

    // Rozmiar płótna = rozmiar pola × gęstość ekranu; obrót telefonu przelicza i przerysowuje.
    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const fit = () => {
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
        if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; paint(); }
      };
      fit();
      const ro = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
      ro?.observe(c);
      return () => ro?.disconnect();
    }, [paint]);

    const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const r = e.currentTarget.getBoundingClientRect();
      // Nacisk tylko z rysika; palec i mysz zgłaszają 0 albo 0,5 — wtedy stała grubość.
      const p = e.pointerType === "pen" && e.pressure > 0 ? 0.6 + e.pressure * 0.8 : 1;
      return { x: e.clientX - r.left, y: e.clientY - r.top, p };
    };

    const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = [point(e)];
      strokes.current.push(drawing.current);
      paint();
    };
    const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
      if (events.length > 0) {
        const r = e.currentTarget.getBoundingClientRect();
        const p = point(e).p;
        for (const ev of events) drawing.current.push({ x: ev.clientX - r.left, y: ev.clientY - r.top, p });
      } else drawing.current.push(point(e));
      paint();
    };
    const onUp = () => {
      if (!drawing.current) return;
      drawing.current = null;
      onChange(strokes.current.length === 0);
    };

    useImperativeHandle(ref, () => ({
      clear() {
        strokes.current = [];
        drawing.current = null;
        paint();
        onChange(true);
      },
      async toBlob() {
        const c = canvasRef.current;
        if (!c || strokes.current.length === 0) return null;
        const dpr = c.width / c.clientWidth || 1;
        const pts = strokes.current.flat();
        const xs = pts.map((q) => q.x * dpr), ys = pts.map((q) => q.y * dpr);
        const x0 = Math.max(0, Math.floor(Math.min(...xs) - EXPORT_PAD)), y0 = Math.max(0, Math.floor(Math.min(...ys) - EXPORT_PAD));
        const x1 = Math.min(c.width, Math.ceil(Math.max(...xs) + EXPORT_PAD)), y1 = Math.min(c.height, Math.ceil(Math.max(...ys) + EXPORT_PAD));
        const out = document.createElement("canvas");
        out.width = Math.max(1, x1 - x0);
        out.height = Math.max(1, y1 - y0);
        out.getContext("2d")?.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
        return new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
      },
    }), [onChange, paint]);

    return (
      <div className="signature-pad relative h-40 overflow-hidden rounded-card border border-border/70 bg-white shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)]">
        {/* Linia podpisu i „×” jak na formularzu — tylko tło, nie część obrazu. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-5 bottom-10 border-b border-[#1f2a44]/35" />
        <span aria-hidden className="pointer-events-none absolute bottom-11 left-5 font-display text-lg leading-none text-[#1f2a44]/55">×</span>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          data-testid="signature-pad"
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        />
      </div>
    );
  },
);
