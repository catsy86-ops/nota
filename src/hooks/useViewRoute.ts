import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { View } from "@/hooks/useFilteredNotes";
import { parseViewRoute, viewPath, withSearch } from "@/lib/viewRoute";
import { SITE_PARAM } from "@/lib/study/siteLink";

/** Stan widoku (widok, folder, etykieta, wyszukiwanie) trzymany w adresie. */
export function useViewRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(() => parseViewRoute(location.pathname, location.search), [location.pathname, location.search]);

  /** Przejście do widoku to nowy wpis w historii — „wstecz” wraca. */
  const go = useCallback((view: View, opts: { label?: string | null; folder?: string | null; search?: string; site?: string } = {}) => {
    const q = opts.search ?? parseViewRoute(window.location.pathname, window.location.search).search;
    let to = viewPath(view, opts) + withSearch(window.location.search, q);
    // Karta budowy (`site`): dopisuje `budowa=<id>` do adresu, np. wiersz „Dziś” → `/praca?budowa=…`.
    if (opts.site) {
      const [path, query = ""] = to.split("?");
      const params = new URLSearchParams(query);
      params.set(SITE_PARAM, opts.site);
      to = `${path}?${params.toString()}`;
    }
    if (to === window.location.pathname + window.location.search) return;
    navigate(to);
  }, [navigate]);

  /** Pisanie w wyszukiwarce podmienia bieżący wpis — bez wpisu na każdy znak. */
  const setSearch = useCallback((q: string) => {
    navigate({ pathname: window.location.pathname, search: withSearch(window.location.search, q) }, { replace: true });
  }, [navigate]);

  /** Zdejmuje `/notatka/:id` z adresu po otwarciu notatki. */
  const replaceWith = useCallback((view: View, opts: { label?: string | null; folder?: string | null; search?: string } = {}) => {
    navigate(viewPath(view, opts) + withSearch(window.location.search, opts.search ?? ""), { replace: true });
  }, [navigate]);

  // Klik w powiadomienie przy otwartej karcie (public/sw-notifications.js).
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: unknown } | null;
      if (data?.type === "open-url" && typeof data.url === "string" && /^\/(?![/\\])/.test(data.url)) navigate(data.url);
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, [navigate]);

  return { ...route, go, setSearch, replaceWith };
}
