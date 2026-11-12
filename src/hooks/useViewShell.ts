import type { useViewRoute } from "@/hooks/useViewRoute";
import { canViewTransition } from "@/lib/viewTransition";
import { pulseSkinSignal } from "@/lib/skinSignal";
import { useState, useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { isMotionReduced } from "@/hooks/useMotionPref";
import { type View } from "@/hooks/useFilteredNotes";
import { parseViewRoute } from "@/lib/viewRoute";
import { playEnter } from "@/lib/motion";
import { useNavigate, useNavigationType } from "react-router-dom";
import { VIEW_ORDER } from "@/pages/indexViews";

/**
 * Powłoka widoku: przejście między działami (View Transitions z kierunkiem), atrybut `data-view` i sygnał stylu,
 * pole wyszukiwania ze stanem lokalnym zsynchronizowanym z adresem (odroczone zapytanie), działy trzymane w pamięci
 * po wyjściu (Grafik i Praca) i wejście treści po zmianie widoku. Wyciągnięte z `Index.tsx` bez zmiany zachowania.
 */
type Route = ReturnType<typeof useViewRoute>;

export function useViewShell(route: Route) {
  const { view, label: activeLabel, folder: activeFolder, go } = route;
  // Zmiana widoku przenika się ze starym (View Transitions); bez wsparcia albo przy ograniczonym ruchu — od razu.
  const setView = useCallback((v: View) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (canViewTransition() && !isMotionReduced()) {
      // Kierunek przesunięcia (plan 2.2): w prawo do działów dalej w kolejności, w lewo do wcześniejszych.
      const dir = VIEW_ORDER.indexOf(v) >= VIEW_ORDER.indexOf(view) ? "fwd" : "back";
      document.documentElement.dataset.vtDir = dir;
      const t = doc.startViewTransition(() => flushSync(() => go(v)));
      void t.finished.finally(() => { delete document.documentElement.dataset.vtDir; });
    } else {
      go(v);
    }
  }, [go, view]);
  // Tabliczka rysunkowa w tle zmienia napis według widoku (CSS: `html[data-view]`).
  // Zmiana widoku odpala sygnał stylu (Zeszyt przewraca kartkę, Matryca spływa kaskadą); pierwsze wejście bez sygnału.
  const firstViewRef = useRef(true);
  useEffect(() => {
    document.documentElement.dataset.view = view;
    if (firstViewRef.current) { firstViewRef.current = false; return; }
    pulseSkinSignal("view");
  }, [view]);
  // Pole wyszukiwania ma własny stan (karetka nie może czekać na router);
  // adres dostaje go z opóźnieniem zerowym, a „wstecz/dalej” wlewa z powrotem.
  const [search, setSearch] = useState(route.search);
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    if (navigationType === "POP") setSearch(route.search);
  }, [route.search, navigationType]);
  // Pole dostaje każdy znak od razu; filtrowanie kart i adres idą odroczonym
  // renderem, który React przerywa przy kolejnym znaku — pisanie nie czeka na 150 kart.
  const deferredSearch = useDeferredValue(search);
  // Plan 3.5: Grafik i Praca zostają zamontowane po wyjściu (`Activity` hidden), więc powrót
  // zachowuje ich stan i nie przerysowuje. Tylko te dwa działy — pamięć na telefonie.
  const [keptViews, setKeptViews] = useState<View[]>([]);
  useEffect(() => {
    if (view !== "shifts" && view !== "study") return;
    setKeptViews((prev) => (prev.includes(view) ? prev : [...prev, view]));
  }, [view]);
  const setRouteSearch = route.setSearch;
  useEffect(() => {
    if (deferredSearch !== parseViewRoute(window.location.pathname, window.location.search).search) setRouteSearch(deferredSearch);
  }, [deferredSearch, setRouteSearch]);
  // Zmiana widoku (także folderu i etykiety): treść osiada fade'em z 6 px,
  // zamiast podmienić się skokiem. Bez przemontowania — szkic w pasku nowej
  // notatki i stan siatek przetrwają; pole wyszukiwania (data-view-static) stoi.
  const mainRef = useRef<HTMLElement>(null);
  const viewKey = `${view}|${activeFolder ?? ""}|${activeLabel ?? ""}`;
  const prevViewKey = useRef(viewKey);
  useLayoutEffect(() => {
    if (prevViewKey.current === viewKey) return;
    prevViewKey.current = viewKey;
    for (const el of mainRef.current?.children ?? []) {
      if (!el.hasAttribute("data-view-static")) playEnter(el, { opacity: 0, transform: "translateY(6px)" });
    }
  }, [viewKey]);

  return { setView, search, setSearch, deferredSearch, navigate, keptViews, mainRef };
}
