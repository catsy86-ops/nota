import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineStatus } from "./components/OfflineStatus";
import { useMotionPref } from "./hooks/useMotionPref";
import { useEffect } from "react";
import { applySeasonAttr, useSeasonPref } from "./lib/seasonTheme";
import { useEffectsSettings } from "./lib/effectsSettings";
import { NotesProvider } from "./hooks/NotesProvider";

const App = () => {
  const { mode } = useMotionPref();
  const { pref: seasonPref } = useSeasonPref();
  const { seasonalTheme } = useEffectsSettings();

  // Paint <html data-season> so seasonal colors apply app-wide.
  useEffect(() => {
    if (seasonalTheme) applySeasonAttr();
    else delete document.documentElement.dataset.season;
  }, [seasonPref, seasonalTheme]);

  // "system" lets framer-motion follow the OS setting; "reduced"/"full" force it.
  const reducedMotion = mode === "system" ? "user" : mode === "reduced" ? "always" : "never";

  return (
    <MotionConfig reducedMotion={reducedMotion}>
      <TooltipProvider>
        <Sonner />
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
  );
};

export default App;
