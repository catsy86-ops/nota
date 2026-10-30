import type { View } from "@/hooks/useFilteredNotes";
import { EMPTY_GLYPHS } from "@/lib/emptyGlyphs";
import { Sketch } from "@/components/art/Sketch";

/**
 * Ilustracje pustych widoków w stylu zeszytu: kartka w linie i szkic „narysowany długopisem” — kreska
 * dorysowuje się jednorazowo na wejściu (bez pętli). Rysunek i wygląd kreski w `components/art/Sketch.tsx`
 * (plan motywów 2.1: CSS zamiast framer-motion, kreska z tokenów stylu).
 */
export function EmptyIllustration({ view }: { view: View }) {
  const paths = EMPTY_GLYPHS[view];
  if (!paths) return null;
  return <Sketch paths={paths} />;
}

/** Szkic z podanych ścieżek — też dla pustych widoków spoza listy Notatek (Dziennik Pracy). */
export const EmptySketch = Sketch;
