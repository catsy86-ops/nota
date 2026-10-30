/**
 * Kształtki hydrauliczne zamiast ikon na dolnym pasku w stylu Hydraulika (plan motywów 3.1):
 * kolano, trójnik i zawór. Rysowane kreską w `currentColor`, 24×24 jak ikony lucide.
 * Widoczne tylko w Hydraulice — CSS (`.hydro-fitting` w hydraulika.css) chowa je w innych stylach,
 * a ikony lucide chowa w Hydraulice (`.nav-lucide`).
 */
export type FittingVariant = "elbow" | "tee" | "valve";

const PATHS: Record<FittingVariant, string[]> = {
  // Kolano: rura z góry skręca w prawo, z kołnierzami na końcach.
  elbow: ["M6 3v8a4 4 0 0 0 4 4h8", "M4 3h4", "M18 15h3"],
  // Trójnik: rura pozioma z odgałęzieniem w dół.
  tee: ["M3 9h18", "M12 9v12", "M3 7v4", "M21 7v4", "M10 21h4"],
  // Zawór: rura pozioma, pokrętło na trzpieniu.
  valve: ["M3 14h18", "M12 14V9", "M8 6h8", "M4 12v4", "M20 12v4"],
};

export function FittingIcon({ variant, className }: { variant: FittingVariant; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[variant].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
