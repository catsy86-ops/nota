import { useRef, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NoteImage } from "@/components/NoteImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Galeria zdjęć z budowy (Etap 3 planu Praca, § D3): czarne tło, przesuwanie palcem między zdjęciami,
 * szczypanie do powiększenia i przesuwanie powiększonego zdjęcia, dwukrotne stuknięcie = 2,5×.
 * Strzałki i klawiatura zostają. Zmiana zdjęcia zeruje powiększenie.
 */
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_PX = 50;
const TAP_MS = 260;

interface Zoom { refs: string[]; index: number }

export function PhotoGalleryDialog({ zoom, onIndex, onClose }: {
  zoom: Zoom | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const gesture = useRef<{ x: number; y: number; dist: number; scale: number; pan: { x: number; y: number }; at: number; moved: boolean } | null>(null);
  const count = zoom?.refs.length ?? 0;

  function go(delta: number) {
    if (!zoom || count < 2) return;
    setScale(1);
    setPan({ x: 0, y: 0 });
    onIndex((zoom.index + delta + count) % count);
  }

  function onTouchStart(e: TouchEvent<HTMLDivElement>) {
    const t = e.touches;
    const first = t[0];
    gesture.current = {
      x: first.clientX, y: first.clientY,
      dist: t.length > 1 ? Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) : 0,
      scale, pan, at: Date.now(), moved: false,
    };
  }

  function onTouchMove(e: TouchEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches;
    if (t.length > 1 && g.dist > 0) {
      const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      setScale(Math.min(MAX_SCALE, Math.max(1, g.scale * (dist / g.dist))));
      g.moved = true;
      return;
    }
    const dx = t[0].clientX - g.x;
    const dy = t[0].clientY - g.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    if (scale > 1) setPan({ x: g.pan.x + dx, y: g.pan.y + dy });
  }

  function onTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || e.touches.length > 0) return;
    const endX = e.changedTouches[0]?.clientX ?? g.x;
    const dx = endX - g.x;
    if (scale <= 1 && Math.abs(dx) > SWIPE_PX) { go(dx < 0 ? 1 : -1); return; }
    if (!g.moved && Date.now() - g.at < TAP_MS) {
      setScale((s) => (s > 1 ? 1 : DOUBLE_TAP_SCALE));
      setPan({ x: 0, y: 0 });
    }
    if (scale <= 1) setPan({ x: 0, y: 0 });
  }

  return (
    <Dialog open={zoom !== null} onOpenChange={(o) => { if (!o) { setScale(1); setPan({ x: 0, y: 0 }); onClose(); } }}>
      <DialogContent
        className="max-w-none w-screen h-dvh p-0 border-0 rounded-none bg-black text-white sm:max-w-none"
        data-testid="journal-photo-zoom"
        onKeyDown={(ev) => {
          if (ev.key === "ArrowRight") { ev.preventDefault(); go(1); }
          if (ev.key === "ArrowLeft") { ev.preventDefault(); go(-1); }
        }}
      >
        <DialogTitle className="sr-only">Zdjęcie z budowy</DialogTitle>
        {zoom && (
          <div
            className="relative flex h-dvh w-full items-center justify-center overflow-hidden touch-none select-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            data-testid="journal-photo-stage"
            data-scale={scale.toFixed(2)}
          >
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transition: gesture.current ? "none" : "transform 180ms ease-out" }}>
              <NoteImage
                key={zoom.refs[zoom.index]}
                imageRef={zoom.refs[zoom.index]}
                alt={`Zdjęcie z budowy ${zoom.index + 1} z ${zoom.refs.length}`}
                loading="eager"
                className="max-h-[92dvh] max-w-[100vw] object-contain"
              />
            </div>
            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Poprzednie zdjęcie"
                  className="pressable absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white">
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Następne zdjęcie"
                  className="pressable absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white">
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
                <p className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-2.5 py-0.5 font-mono text-xs tabular-nums text-white" aria-live="polite" data-testid="journal-photo-counter">
                  {zoom.index + 1}/{count}
                </p>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
