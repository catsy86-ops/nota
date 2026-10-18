/**
 * Tło aplikacji: papier w kratkę jak w zeszycie (linie w `.paper-grid`, `index.css`).
 * Nieruchome i bez JS — jedna warstwa z gradientami tła, wygaszona maską ku dołowi.
 * Zastąpiło kolorowe poświaty („aurorę”), które nic nie mówiły o aplikacji.
 */
export function PaperBackdrop() {
  return (
    <div
      aria-hidden
      className="paper-grid pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
      style={{ contain: "strict" }}
    >
      {/* Tabliczka rysunkowa: napis zależy od widoku (`html[data-view]`, styl w `index.css`). */}
      <span className="paper-stamp" />
    </div>
  );
}
