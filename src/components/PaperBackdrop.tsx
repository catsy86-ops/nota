import { lazy, Suspense, type CSSProperties } from "react";
import { useSkin } from "@/lib/skins";

/**
 * Tło aplikacji: papier w kratkę jak w zeszycie (linie w `.paper-grid`, `index.css`).
 * Nieruchome i bez JS — jedna warstwa z gradientami tła, wygaszona maską ku dołowi.
 * Zastąpiło kolorowe poświaty („aurorę”), które nic nie mówiły o aplikacji.
 *
 * Dwa style mają własny ruch: „Matryca” (płótno z deszczem, leniwie) i „Hydraulika”
 * (bąbelki; woda płynie z CSS w `skins.css`).
 */
const MatrixRain = lazy(() => import("@/components/skins/MatrixRain"));

/** Pozycje bąbelków: lewa krawędź, średnica, czas wznoszenia, opóźnienie, dryf w poziomie. */
const BUBBLES = [
  { left: "6%", d: 10, t: 11, delay: -2, x: 6 },
  { left: "17%", d: 6, t: 8, delay: -5, x: -4 },
  { left: "29%", d: 14, t: 13, delay: -1, x: 8 },
  { left: "44%", d: 8, t: 9, delay: -7, x: -6 },
  { left: "58%", d: 12, t: 12, delay: -3, x: 4 },
  { left: "71%", d: 7, t: 10, delay: -9, x: -8 },
  { left: "84%", d: 11, t: 14, delay: -4, x: 6 },
  { left: "93%", d: 9, t: 9, delay: -6, x: -5 },
];

export function PaperBackdrop() {
  const skin = useSkin();
  return (
    <div
      aria-hidden
      className="paper-grid pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
      style={{ contain: "strict" }}
    >
      {/* Tabliczka rysunkowa: napis zależy od widoku (`html[data-view]`, styl w `index.css`). */}
      <span className="paper-stamp" />
      {skin === "matrix" && (
        <Suspense fallback={null}>
          <MatrixRain />
        </Suspense>
      )}
      {/* Warstwa sygnału zapisu dla Zorzy (fala) i Matrycy (linia skanu). Pseudo-elementy są zajęte
          przez tło tych stylów, więc sygnał ma własny, pusty element; CSS w skins.css. */}
      {(skin === "zorza" || skin === "matrix") && <span className="sig-layer" />}
      {skin === "hydraulika" && (
        <span className="hydro-bubbles">
          {BUBBLES.map((b, i) => (
            <span
              key={i}
              className="hydro-bubble"
              style={{
                left: b.left,
                width: b.d,
                height: b.d,
                animationDuration: `${b.t}s`,
                animationDelay: `${b.delay}s`,
                "--x": `${b.x}px`,
              } as CSSProperties}
            />
          ))}
        </span>
      )}
    </div>
  );
}
