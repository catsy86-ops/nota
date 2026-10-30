import { useEffect, useRef, useState } from "react";
import { MATRIX_FRAME_MS, MATRIX_GLYPHS, matrixColumns, matrixFontPx } from "./matrixParams";

/**
 * Deszcz znaków w stylu „matrix” na płótnie (styl Matryca). Ładowany leniwie z `PaperBackdrop`,
 * tylko gdy styl jest wybrany. Rysuje tło pod treścią, bez zdarzeń myszy.
 *
 * Oszczędności: ograniczenie do 24 klatek/s, DPR najwyżej 1,5, wstrzymanie w ukrytej karcie,
 * większe znaki i mniej kolumn na telefonie. Ograniczony ruch: jedna nieruchoma klatka.
 */

const FADE = "rgba(0, 0, 0, 0.09)";
/** Jasny wariant (plan motywów 2.5): ciemne znaki na jasnym papierze, smuga wygaszana jaśniejszym kolorem. */
const FADE_LIGHT = "rgba(240, 250, 242, 0.12)";
const HEAD_LIGHT = "#0b3d1a";
const TRAIL_LIGHT = "#0f7a2c";
/** Promień, w którym znaki zbierają się w kursor (px). Tylko myszą — na dotyku nie ma najechania. */
const GATHER_RADIUS = 150;
const HEAD = "#d7ffe0";
const TRAIL = "#00ff41";

/** `still` — „ciche” tło (plan motywów 1.3): jedna nieruchoma klatka, jak przy ograniczonym ruchu. */
export default function MatrixRain({ still = false, light = false }: { still?: boolean; /** Jasny schemat Matrycy. */ light?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Zmiana ruchu (system albo przełącznik w Ustawieniach) przemontowuje płótno — wtedy efekt czyta ustawienie od nowa.
  const [motionTick, setMotionTick] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const bump = () => setMotionTick((n) => n + 1);
    const mo = new MutationObserver(bump);
    mq.addEventListener("change", bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
    return () => { mq.removeEventListener("change", bump); mo.disconnect(); };
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || document.documentElement.dataset.motion === "reduced";
    const fontPx = matrixFontPx(coarse);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const font = `${fontPx}px 'JetBrains Mono Variable', ui-monospace, monospace`;

    let width = 0;
    let height = 0;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;
    let resizeTimer = 0;
    // Pozycja kursora w układzie płótna; poza ekranem (domyślnie) efekt nie działa.
    let px = -1e5;
    let py = -1e5;

    const fill = () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = font;
      // Kolumna startuje w losowym miejscu nad ekranem, żeby deszcz nie zaczynał się falą.
      drops = Array.from({ length: matrixColumns(width, fontPx) }, () => -Math.random() * (height / fontPx));
      fill();
    };

    const step = () => {
      ctx.fillStyle = light ? FADE_LIGHT : FADE;
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < drops.length; i++) {
        const x = i * fontPx;
        const y = drops[i] * fontPx;
        const glyph = MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)];
        ctx.fillStyle = light ? HEAD_LIGHT : HEAD;
        // Głowa kolumny blisko kursora ciągnie się w jego stronę: im bliżej, tym mocniej.
        const dx = px - x;
        const dy = py - y;
        const dist = Math.hypot(dx, dy);
        if (dist < GATHER_RADIUS) {
          const k = (1 - dist / GATHER_RADIUS) * 0.6;
          ctx.fillText(glyph, x + dx * k, y + dy * k);
        } else {
          ctx.fillText(glyph, x, y);
        }
        // Ogon tuż za głową: zwykły kolor, nie cień.
        ctx.fillStyle = light ? TRAIL_LIGHT : TRAIL;
        ctx.fillText(MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)], x, y - fontPx);
        // Kolumna po zejściu poza ekran wraca na górę — czasem od razu, czasem później (rozrzut).
        if (y > height && Math.random() > 0.975) drops[i] = 0;
        else drops[i] += 1;
      }
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < MATRIX_FRAME_MS) return;
      last = t;
      step();
    };

    const start = () => {
      if (reduced) {
        // Ograniczony ruch: kilka klatek od razu i stop — obraz deszczu, bez animacji.
        for (let i = 0; i < 40; i++) step();
        return;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onPointer = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
    };
    // Mysz opuszcza okno: przeglądarka wysyła `pointerout` bez elementu docelowego.
    const onPointerOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      px = -1e5;
      py = -1e5;
    };
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 200);
    };

    resize();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    // Najechanie tylko przy myszy i bez ograniczonego ruchu.
    const hover = !coarse && !reduced;
    if (hover) {
      window.addEventListener("pointermove", onPointer);
      window.addEventListener("pointerout", onPointerOut);
    }
    return () => {
      stop();
      window.clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      if (hover) {
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("pointerout", onPointerOut);
      }
    };
  }, [still, light, motionTick]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0" />;
}
