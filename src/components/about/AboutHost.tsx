import { lazy, Suspense, useEffect, useState } from "react";
import { SIGNALS } from "@/lib/storage/names";

const AboutDialog = lazy(() => import("./AboutDialog").then((m) => ({ default: m.AboutDialog })));

/** Otwiera „O aplikacji” na sygnał `SIGNALS.about` (pasek boczny, arkusz „Więcej”); treść ładuje się przy pierwszym otwarciu. */
export function AboutHost() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const onAbout = () => { setLoaded(true); setOpen(true); };
    window.addEventListener(SIGNALS.about, onAbout);
    return () => window.removeEventListener(SIGNALS.about, onAbout);
  }, []);
  if (!loaded) return null;
  return (
    <Suspense fallback={null}>
      <AboutDialog open={open} onOpenChange={setOpen} />
    </Suspense>
  );
}
