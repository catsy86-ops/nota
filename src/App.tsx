import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LazyMotion, MotionConfig } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HoverTip } from "@/components/HoverTip";
import Index from "./pages/Index.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineStatus } from "./components/OfflineStatus";
import { useMotionPref } from "./hooks/useMotionPref";
import { useEffect } from "react";
import { applySeasonAttr, useSeasonPref } from "./lib/seasonTheme";
import { useEffectsSettings } from "./lib/effectsSettings";
import { startScrollParallax } from "./lib/scrollParallax";
import { pulseDawnIfNewDay } from "./lib/skinSignal";
import { NotesProvider } from "./hooks/NotesProvider";

// Funkcje animacji dociągane po starcie (osobna paczka). `strict`: pełny `motion` zamiast
// lekkiego `m` rzuci błąd — w komponentach importujemy `m as motion` z framer-motion.
const loadMotionFeatures = () => import("./lib/motionFeatures").then((mod) => mod.default);

const App = () => {
  const { mode } = useMotionPref();
  const { pref: seasonPref } = useSeasonPref();
  const { seasonalTheme } = useEffectsSettings();

  // Paint <html data-season> so seasonal colors apply app-wide. Wybrana konkretna pora roku
  // działa od razu; „Auto” wymaga włączonego efektu „Motyw sezonowy”.
  useEffect(() => {
    if (seasonalTheme || seasonPref !== "auto") applySeasonAttr();
    else delete document.documentElement.dataset.season;
  }, [seasonPref, seasonalTheme]);

  // Zorza: paralaksa wstęg przy przewijaniu; Neon: rozbłysk nagłówka przy pierwszym uruchomieniu dnia.
  useEffect(() => startScrollParallax(), []);
  useEffect(() => { pulseDawnIfNewDay(); }, []);

  // "system" lets framer-motion follow the OS setting; "reduced"/"full" force it.
  const reducedMotion = mode === "system" ? "user" : mode === "reduced" ? "always" : "never";

  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <MotionConfig reducedMotion={reducedMotion}>
      <TooltipProvider>
        <Sonner />
        <HoverTip />
        <OfflineStatus />
        <BrowserRouter>
          <ErrorBoundary>
            <NotesProvider>
              <Routes>
                {/* Jedna trasa na całą aplikację: widok siedzi w adresie
                    (src/lib/viewRoute.ts), a osobne <Route> przemontowałyby
                    Index przy każdym przejściu. Nieznana ścieżka = Notatki. */}
                <Route path="/*" element={<Index />} />
              </Routes>
            </NotesProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </MotionConfig>
    </LazyMotion>
  );
};

export default App;
