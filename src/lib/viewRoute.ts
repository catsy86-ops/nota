import type { View } from "@/hooks/useFilteredNotes";

/**
 * Stan widoku w adresie: odświeżenie zostawia w tym samym folderze,
 * systemowe „wstecz” wraca z folderu zamiast zamykać PWA, a notatkę
 * da się otworzyć linkiem (`/notatka/:id`).
 */
export interface ViewRoute {
  view: View;
  label: string | null;
  folder: string | null;
  search: string;
  /** Tylko przy `/notatka/:id` — jednorazowe „otwórz tę notatkę”. */
  noteId: string | null;
}

const SIMPLE: Record<string, View> = {
  "": "notes",
  dzis: "today",
  tydzien: "week",
  archiwum: "archive",
  przypomnienia: "reminders",
  kalendarz: "calendar",
  widget: "widget",
  kosz: "trash",
};
const SLUG: Partial<Record<View, string>> = Object.fromEntries(Object.entries(SIMPLE).map(([k, v]) => [v, k]));

function decode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function parseViewRoute(pathname: string, search: string): ViewRoute {
  const q = new URLSearchParams(search).get("q") ?? "";
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/");
  const base: ViewRoute = { view: "notes", label: null, folder: null, search: q, noteId: null };
  const [head, arg] = [parts[0] ?? "", parts[1] ? decode(parts[1]) : ""];
  if (head === "folder" && arg) return { ...base, view: "folder", folder: arg };
  if (head === "etykieta" && arg) return { ...base, view: "label", label: arg };
  if (head === "notatka" && arg) return { ...base, noteId: arg };
  if (head in SIMPLE && !parts[1]) return { ...base, view: SIMPLE[head] };
  return base;
}

/** Ścieżka widoku (bez zapytania). Widok bez wymaganego argumentu → Notatki. */
export function viewPath(view: View, opts: { label?: string | null; folder?: string | null } = {}): string {
  if (view === "folder") return opts.folder ? `/folder/${encodeURIComponent(opts.folder)}` : "/";
  if (view === "label") return opts.label ? `/etykieta/${encodeURIComponent(opts.label)}` : "/";
  return `/${SLUG[view] ?? ""}`;
}

/** Zapytanie z `q`, z zachowaniem innych parametrów (`?pair=`, `?share=`, `?new=`). */
export function withSearch(currentSearch: string, q: string): string {
  const params = new URLSearchParams(currentSearch);
  if (q) params.set("q", q); else params.delete("q");
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function notePath(id: string): string {
  return `/notatka/${encodeURIComponent(id)}`;
}
