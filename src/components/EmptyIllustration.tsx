import { m as motion } from "framer-motion";
import type { View } from "@/hooks/useFilteredNotes";
import { EMPTY_GLYPHS } from "@/lib/emptyGlyphs";
import { isMotionReduced } from "@/hooks/useMotionPref";

/**
 * Ilustracje pustych widoków w stylu zeszytu: kartka w linie i szkic
 * „narysowany długopisem” - kreska dorysowuje się jednorazowo na wejściu
 * (bez pętli). Reduced motion: od razu stan końcowy.
 */
export function EmptyIllustration({ view }: { view: View }) {
  const paths = EMPTY_GLYPHS[view];
  if (!paths) return null;
  const still = isMotionReduced();
  return (
    <svg
      viewBox="0 0 120 84"
      className="relative mx-auto h-28 w-40 text-primary-ink"
      aria-hidden="true"
      data-testid="empty-illustration"
    >
      {/* Linie kartki. */}
      {[72, 78].map((y) => (
        <line key={y} x1="10" x2="110" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
      ))}
      {paths.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={still ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.35 + i * 0.18, duration: 0.35, ease: "easeInOut" }}
        />
      ))}
      {/* Podkreślenie jednym pociągnięciem. */}
      <motion.path
        d="M22 76 C46 72 76 80 98 74"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeLinecap="round"
        initial={still ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5 + paths.length * 0.18, duration: 0.45, ease: "easeOut" }}
      />
    </svg>
  );
}
