import { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { isNativeShell } from "@/lib/native/platform";
import { launchTarget, readLastSeen, resumeTarget, writeLastSeen, isRestorablePath } from "@/lib/resumeView";

/** Tylko zainstalowana aplikacja: w karcie przeglądarki adres wybiera użytkownik. */
function installed(): boolean {
  return isNativeShell() || (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches);
}

/** Coś trwa na ekranie — otwarte okno albo pisanie — więc nie przełączamy działu pod palcem. */
function busy(): boolean {
  if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return true;
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
}

/**
 * Q3.4 (QL-3): zimny start z ikony wraca do ostatniego działu, a po 4 h przerwy (także przy powrocie do schowanej
 * aplikacji) zaczyna od „Dziś”. Ostatni adres i chwila schowania w `kaczy.lastSeen.v1` (lokalnie, poza kopią).
 */
export function useResumeView(navigate: NavigateFunction) {
  useEffect(() => {
    if (!installed()) return;
    const target = launchTarget(window.location, readLastSeen(), Date.now());
    if (target) navigate(target, { replace: true });

    let hiddenAt: number | null = null;
    const record = () => {
      const path = window.location.pathname + window.location.search;
      hiddenAt = Date.now();
      writeLastSeen({ at: hiddenAt, path: isRestorablePath(path) ? path : "/" });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { record(); return; }
      const next = resumeTarget(hiddenAt, Date.now(), window.location.pathname);
      hiddenAt = null;
      if (next && !busy()) navigate(next);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", record);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", record);
    };
  }, [navigate]);
}
