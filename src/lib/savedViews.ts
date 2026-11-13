import * as Y from "yjs";
import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import type { GroupBy } from "@/lib/groupNotes";
import type { Layout, SortDir, SortKey, ViewPrefs } from "@/lib/viewPrefs";

/**
 * Zapisane widoki (nowy plan 6.1, Notatki 6.2): źródło notatek (wszystkie, folder albo etykieta),
 * zapytanie wyszukiwarki, układ, sortowanie, grupowanie i filtry — pod jedną nazwą w pasku bocznym.
 * Dane w mapie `views` dokumentu Yjs (synchronizują się między urządzeniami). Każdy widok to jedna
 * wartość LWW: zmiana zapisuje cały obiekt, więc dwie zmiany tego samego widoku naraz — wygrywa jedna.
 * Wszystko z mapy jest niezaufane (peer), stąd `sanitizeView`.
 */
export type ViewSource = { kind: "all" } | { kind: "folder"; id: string } | { kind: "label"; label: string };

export interface SavedView {
  id: string;
  name: string;
  source: ViewSource;
  query: string;
  layout: Layout;
  sortKey: SortKey;
  sortDir: SortDir;
  groupBy: GroupBy;
  filterColor: ViewPrefs["filterColor"];
  filterLabel: string;
  filterHasReminder: boolean;
  filterPriority: ViewPrefs["filterPriority"];
  /** Ukryte kolumny tabeli w tym widoku (6.1: „widoczne kolumny”). */
  tableHidden: string[];
  createdAt: number;
}

export const MAX_VIEWS = 30;
export const MAX_VIEW_NAME = 40;

const LAYOUTS: readonly Layout[] = ["masonry", "grid", "list", "board", "table", "gallery"];
const SORTS = ["updated", "created", "opened", "title", "color", "priority", "manual"] as const;
const GROUPS: readonly GroupBy[] = ["none", "date", "label", "folder"];
const COLORS = ["all", "default", "coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"] as const;
const PRIORITIES = ["all", "none", "low", "medium", "high"] as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback);

function cleanSource(v: unknown): ViewSource {
  const s = v as { kind?: unknown; id?: unknown; label?: unknown } | null;
  if (s?.kind === "folder" && typeof s.id === "string" && s.id) return { kind: "folder", id: s.id.slice(0, 100) };
  if (s?.kind === "label" && typeof s.label === "string" && s.label) return { kind: "label", label: s.label.slice(0, 200) };
  return { kind: "all" };
}

/** Widok z mapy albo `null`, gdy wpis jest uszkodzony (brak nazwy). Nieznane wartości wracają do domyślnych. */
export function sanitizeView(id: string, raw: unknown): SavedView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name, MAX_VIEW_NAME).trim();
  if (!id || !name) return null;
  const sortKey = typeof r.sortKey === "string" && /^prop:[\w-]{1,100}$/.test(r.sortKey) ? (r.sortKey as SortKey) : oneOf(r.sortKey, SORTS, "updated");
  return {
    id: id.slice(0, 100),
    name,
    source: cleanSource(r.source),
    query: str(r.query, 500),
    layout: oneOf(r.layout, LAYOUTS, "masonry"),
    sortKey,
    sortDir: r.sortDir === "asc" ? "asc" : "desc",
    groupBy: oneOf(r.groupBy, GROUPS, "none"),
    filterColor: oneOf(r.filterColor, COLORS, "all") as SavedView["filterColor"],
    filterLabel: str(r.filterLabel, 200) || "all",
    filterHasReminder: r.filterHasReminder === true,
    filterPriority: oneOf(r.filterPriority, PRIORITIES, "all") as SavedView["filterPriority"],
    // Klucze kolumn: krótkie napisy, najwyżej 20 (wpis od peera nie może puchnąć).
    tableHidden: Array.isArray(r.tableHidden) ? r.tableHidden.filter((k): k is string => typeof k === "string" && k.length <= 120).slice(0, 20) : [],
    createdAt: typeof r.createdAt === "number" && Number.isFinite(r.createdAt) ? r.createdAt : 0,
  };
}

export function projectViews(map: Y.Map<unknown>): SavedView[] {
  const out: SavedView[] = [];
  map.forEach((raw, id) => { const v = sanitizeView(id, raw); if (v) out.push(v); });
  return out.sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name)).slice(0, MAX_VIEWS);
}

/** Widok z bieżącego stanu ekranu: skąd są notatki, co wpisano w szukaj i jak jest ułożone. */
export function viewFromCurrent(id: string, name: string, source: ViewSource, query: string, prefs: ViewPrefs, now: number): SavedView | null {
  return sanitizeView(id, {
    name, source, query: query.trim(), layout: prefs.layout, sortKey: prefs.sortKey, sortDir: prefs.sortDir, groupBy: prefs.groupBy,
    filterColor: prefs.filterColor, filterLabel: prefs.filterLabel, filterHasReminder: prefs.filterHasReminder, filterPriority: prefs.filterPriority,
    tableHidden: prefs.tableHidden,
    createdAt: now,
  });
}

export function sameSource(a: ViewSource, b: ViewSource): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "folder" && b.kind === "folder") return a.id === b.id;
  if (a.kind === "label" && b.kind === "label") return a.label === b.label;
  return true;
}

/** Krótki opis widoku do podpowiedzi w pasku („Tabela · #budowa · beton”). */
export function viewSummary(v: SavedView, folderName?: (id: string) => string | undefined): string {
  const layout: Record<Layout, string> = { masonry: "Kafle", grid: "Siatka", list: "Lista", board: "Tablica", table: "Tabela", gallery: "Galeria" };
  const src = v.source.kind === "folder" ? folderName?.(v.source.id) ?? "folder" : v.source.kind === "label" ? `#${v.source.label}` : "";
  return [layout[v.layout], src, v.query].filter(Boolean).join(" · ");
}

// --- magazyn na dokumencie aplikacji ---

const viewsMap = (): Y.Map<unknown> => yjsStore.doc.getMap<unknown>("views");
let cache: SavedView[] | null = null;
const listeners = new Set<() => void>();
let observing = false;

function ensureObserved() {
  if (observing) return;
  observing = true;
  viewsMap().observe(() => { cache = null; listeners.forEach((l) => l()); });
}

function getViews(): SavedView[] {
  ensureObserved();
  cache ??= projectViews(viewsMap());
  return cache;
}

function subscribe(l: () => void) {
  ensureObserved();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSavedViews(): SavedView[] {
  return useSyncExternalStore(subscribe, getViews, getViews);
}

/** Zapis (nowy albo zmieniony). `false` = limit widoków albo pusta nazwa. */
export function saveView(v: SavedView): boolean {
  const clean = sanitizeView(v.id, v);
  if (!clean) return false;
  const map = viewsMap();
  if (!map.has(clean.id) && getViews().length >= MAX_VIEWS) return false;
  const { id, ...data } = clean;
  yjsStore.doc.transact(() => map.set(id, data));
  return true;
}

export function renameView(id: string, name: string): void {
  const v = getViews().find((x) => x.id === id);
  const n = name.trim().replace(/\s+/g, " ").slice(0, MAX_VIEW_NAME);
  if (v && n) saveView({ ...v, name: n });
}

/** Kopia zapasowa: wszystkie widoki jako tablica (wpisy bez nazwy odpadają). */
export function viewsDump(): SavedView[] {
  return getViews();
}

/** Scalanie z kopii: widoki o znanym id są nadpisywane, nowe dopisywane; limit i walidacja jak przy zapisie. */
export function mergeViewsDump(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  let saved = 0;
  for (const item of raw) {
    const v = sanitizeView(String((item as { id?: unknown })?.id ?? ""), item);
    if (v && saveView(v)) saved++;
  }
  return saved;
}

export function removeView(id: string): SavedView | null {
  const v = getViews().find((x) => x.id === id) ?? null;
  yjsStore.doc.transact(() => viewsMap().delete(id));
  return v;
}
