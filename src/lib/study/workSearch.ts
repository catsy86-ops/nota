import { useEffect, useMemo, useState } from "react";
import type MiniSearch from "minisearch";
import { searchWorkKeys } from "@/workers/workSearch";
import { makeIndex, searchKeys, type IndexDoc } from "./workSearchCore";
import { entrySiteId, type SiteInfo } from "./sites";
import { fittingsLine } from "./fittings";
import { pipesLine } from "./pipes";
import type { JournalEntry } from "./journalEntry";

/**
 * Wyszukiwanie w Pracy (B2.5): wpisy (tekst, podpisy zdjęć, rozwiązanie, kształtki, rury), braki
 * i nazwy dokumentów z kart budów. MiniSearch: bez ogonków, z literówkami i początkami słów, każde
 * słowo zapytania musi pasować („zawór Lipowa” = zawór na budowie Lipowa). Indeks powstaje leniwie —
 * dopiero przy pierwszym niepustym zapytaniu — a biblioteka ładuje się osobnym fragmentem.
 */

export type WorkHitKind = "entry" | "shortage" | "doc";

export interface WorkHit {
  /** Unikalny klucz trafienia (`entry:…`, `shortage:…`, `doc:…`). */
  key: string;
  kind: WorkHitKind;
  siteId: string;
  siteName: string;
  /** Główny tekst: początek wpisu, nazwa braku albo dokumentu. */
  title: string;
  /** Wpis ze zdjęciami (paleta pokazuje ikonę). */
  hasPhotos: boolean;
  at: number;
}

/** Dokumenty indeksu i opisy trafień — czysta funkcja, testowana bez biblioteki. */
export function workDocs(dir: readonly SiteInfo[], journal: readonly JournalEntry[]): { docs: IndexDoc[]; hits: Map<string, WorkHit> } {
  const docs: IndexDoc[] = [];
  const hits = new Map<string, WorkHit>();
  const names = new Map(dir.map((x) => [x.id, x.name] as const));
  const add = (hit: WorkHit, text: string) => {
    hits.set(hit.key, hit);
    docs.push({ key: hit.key, text, site: hit.siteName });
  };

  for (const e of journal) {
    const siteId = entrySiteId(e);
    const siteName = (siteId && names.get(siteId)) || e.site;
    add({
      key: `entry:${e.id}`, kind: "entry", siteId, siteName,
      title: e.text.trim().slice(0, 80) || "bez opisu", hasPhotos: e.images.length > 0, at: e.at,
    }, [
      e.text, e.solution ?? "", ...Object.values(e.captions ?? {}),
      e.fittings?.length ? fittingsLine(e.fittings) : "", e.pipes?.length ? pipesLine(e.pipes) : "",
    ].join("\n"));
  }
  for (const s of dir) {
    for (const sh of s.shortages ?? []) {
      add({ key: `shortage:${s.id}:${sh.id}`, kind: "shortage", siteId: s.id, siteName: s.name, title: [sh.text, sh.qty].filter(Boolean).join(" · "), hasPhotos: false, at: sh.at }, `${sh.text} ${sh.qty}`);
    }
    for (const d of s.docs ?? []) {
      add({ key: `doc:${s.id}:${d.id}`, kind: "doc", siteId: s.id, siteName: s.name, title: d.name, hasPhotos: false, at: d.at }, d.name);
    }
  }
  return { docs, hits };
}

export interface WorkIndex {
  search: (query: string, limit?: number) => WorkHit[];
}

export function buildWorkIndex(Engine: typeof MiniSearch, dir: readonly SiteInfo[], journal: readonly JournalEntry[]): WorkIndex {
  const { docs, hits } = workDocs(dir, journal);
  const mini = makeIndex(Engine, docs);
  return {
    search: (query, limit = 8) => searchKeys(mini, query, limit).flatMap((k) => { const h = hits.get(k); return h ? [h] : []; }),
  };
}

/**
 * Trafienia dla zapytania. Indeks MiniSearch buduje i przeszukuje Worker (B5.6), więc pierwsze zapytanie nie blokuje
 * wątku UI; do czasu odpowiedzi zostają poprzednie trafienia (albo `[]` na początku — wołający może w tym czasie pokazać
 * swoje dokładne dopasowanie). Dokumenty przebudowują się tylko przy zmianie wpisów albo budów i tylko gdy zapytanie
 * nie jest puste.
 */
export function useWorkSearch(query: string, dir: readonly SiteInfo[], journal: readonly JournalEntry[], limit = 8): WorkHit[] {
  const active = query.trim() !== "";
  const prepared = useMemo(() => (active ? workDocs(dir, journal) : null), [active, dir, journal]);
  const [found, setFound] = useState<WorkHit[]>([]);
  useEffect(() => {
    if (!prepared) { setFound([]); return; }
    let alive = true;
    void searchWorkKeys(prepared.docs, query, limit).then((keys) => {
      if (alive) setFound(keys.flatMap((k) => { const h = prepared.hits.get(k); return h ? [h] : []; }));
    });
    return () => { alive = false; };
  }, [prepared, query, limit]);
  return active ? found : [];
}
