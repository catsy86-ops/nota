/**
 * Etapy budowy (instalacja wod-kan w domku jednorodzinnym): lista w karcie budowy, odhaczana
 * na budowie, z postępem w raporcie dla szefa. Karta bez własnej listy ma `DEFAULT_STAGES`;
 * pierwsza zmiana (odhaczenie, dodanie, usunięcie) zapisuje całą listę w karcie (`SiteCard.stages`).
 * Czysta logika — zapis w `store.ts`, widok w `SiteStagesPanel.tsx`.
 */

export interface SiteStage {
  /** Stałe id etapu (domyślne: czytelne, własne: `s-…`). */
  id: string;
  name: string;
  /** Etap zakończony — moment odhaczenia (ms); brak = do zrobienia. */
  done?: number;
}

export const STAGE_NAME_MAX = 60;
export const STAGES_MAX = 20;

/** Typowa kolejność na domku: najpierw pod posadzką, na końcu biały montaż i odbiór. */
export const DEFAULT_STAGES: readonly SiteStage[] = [
  { id: "kan-pod", name: "Kanalizacja podposadzkowa" },
  { id: "woda", name: "Rozprowadzenie wody" },
  { id: "kan-pion", name: "Piony i podejścia kanalizacji" },
  { id: "proba", name: "Próba szczelności" },
  { id: "zakrycie", name: "Zakrycie instalacji" },
  { id: "bialy", name: "Biały montaż" },
  { id: "odbior", name: "Odbiór" },
];

/** Lista etapów karty: zapisana albo domyślna (kopia — można ją zmieniać). */
export function siteStages(card: { stages?: readonly SiteStage[] } | null | undefined): SiteStage[] {
  return (card?.stages ?? DEFAULT_STAGES).map((s) => ({ ...s }));
}

/** Dowolne wejście z dokumentu → lista etapów; `undefined` = karta bez własnej listy. */
export function cleanStages(raw: unknown): SiteStage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SiteStage[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const s = v as Partial<SiteStage>;
    if (typeof s.id !== "string" || !s.id || s.id.length > 40 || seen.has(s.id)) continue;
    const name = typeof s.name === "string" ? s.name.trim().slice(0, STAGE_NAME_MAX) : "";
    if (!name) continue;
    seen.add(s.id);
    out.push({ id: s.id, name, ...(typeof s.done === "number" && Number.isFinite(s.done) ? { done: s.done } : {}) });
    if (out.length >= STAGES_MAX) break;
  }
  return out;
}

export interface StageProgress {
  done: number;
  total: number;
  /** Pierwszy nieodhaczony etap w kolejności listy; `null` = wszystko zrobione albo pusta lista. */
  next: SiteStage | null;
}

export function stageProgress(stages: readonly SiteStage[]): StageProgress {
  return {
    done: stages.filter((s) => s.done !== undefined).length,
    total: stages.length,
    next: stages.find((s) => s.done === undefined) ?? null,
  };
}

/** Odhacza albo cofa etap; data odhaczenia — `now`. */
export function toggleStage(stages: readonly SiteStage[], id: string, now: number): SiteStage[] {
  return stages.map((s) => {
    if (s.id !== id) return { ...s };
    if (s.done !== undefined) return { id: s.id, name: s.name };
    return { ...s, done: now };
  });
}

const newId = () => `s-${Math.random().toString(36).slice(2, 10)}`;

/** Dodaje własny etap na koniec; pusta nazwa, duplikat nazwy albo limit → lista bez zmian. */
export function addStage(stages: readonly SiteStage[], name: string, makeId: () => string = newId): SiteStage[] {
  const n = name.trim().replace(/\s+/g, " ").slice(0, STAGE_NAME_MAX);
  const list = stages.map((s) => ({ ...s }));
  if (!n || list.length >= STAGES_MAX) return list;
  if (list.some((s) => s.name.toLocaleLowerCase("pl") === n.toLocaleLowerCase("pl"))) return list;
  let id = makeId();
  while (list.some((s) => s.id === id)) id = makeId();
  return [...list, { id, name: n }];
}

export function removeStage(stages: readonly SiteStage[], id: string): SiteStage[] {
  return stages.filter((s) => s.id !== id).map((s) => ({ ...s }));
}
