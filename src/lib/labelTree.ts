/**
 * Etykiety zagnieżdżone: `budowa/łazienka` to etykieta „łazienka” wewnątrz „budowa”.
 * Model bez zmian — etykieta dalej jest napisem; hierarchię niesie separator `/`.
 *
 * Reguły: filtr po rodzicu obejmuje dzieci, zmiana nazwy gałęzi przepina całe poddrzewo,
 * a puste segmenty (`a//b`, `/a`) są usuwane przy zapisie.
 */

export const LABEL_SEP = "/";
/** Maksymalna głębokość zagnieżdżenia — dalej drzewo w pasku bocznym zrobiłoby się nieczytelne. */
export const LABEL_MAX_DEPTH = 6;

/** Normalizuje ścieżkę etykiety: przycina segmenty, usuwa puste, ogranicza głębokość. `""` = nieprawidłowa. */
export function cleanLabelPath(raw: string): string {
  const segments = raw
    .split(LABEL_SEP)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, LABEL_MAX_DEPTH);
  return segments.join(LABEL_SEP);
}

/** Głębokość: `budowa` = 1, `budowa/łazienka` = 2. */
export function labelDepth(label: string): number {
  return label ? label.split(LABEL_SEP).length : 0;
}

/** Rodzic etykiety albo `null` dla korzenia. */
export function parentLabel(label: string): string | null {
  const i = label.lastIndexOf(LABEL_SEP);
  return i < 0 ? null : label.slice(0, i);
}

/** Czy `label` jest `ancestor` albo leży w jego poddrzewie. */
export function isUnderLabel(label: string, ancestor: string): boolean {
  return label === ancestor || label.startsWith(ancestor + LABEL_SEP);
}

/** Filtr po etykiecie w notatce: dopasowuje ją i wszystkie dzieci filtra. */
export function noteMatchesLabel(noteLabels: readonly string[], filter: string): boolean {
  return noteLabels.some((l) => isUnderLabel(l, filter));
}

/**
 * Zmiana nazwy gałęzi: `from` i całe jego poddrzewo przechodzą na `to`.
 * Zwraca nową listę bez duplikatów; etykiety spoza gałęzi zostają.
 */
export function renameLabelBranch(labels: readonly string[], from: string, to: string): string[] {
  const target = cleanLabelPath(to);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const next = isUnderLabel(label, from) ? target + label.slice(from.length) : label;
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

export interface LabelRow {
  label: string;
  depth: number;
  /** Nazwa wyświetlana: ostatni segment ścieżki. */
  name: string;
  /** Ma dzieci w zbiorze — pokazuje strzałkę zwijania. */
  hasChildren: boolean;
}

/**
 * Spłaszczone drzewo do paska bocznego, w kolejności alfabetycznej z rodzicem przed dziećmi.
 * Rodzic, którego nie ma w zbiorze (`a/b` bez `a`), dostaje własny wiersz z tą samą głębokością
 * co w ścieżce — nie znika z listy.
 */
export function buildLabelRows(labels: readonly string[]): LabelRow[] {
  const all = new Set<string>();
  for (const l of labels) {
    const parts = l.split(LABEL_SEP);
    for (let i = 1; i <= parts.length; i++) all.add(parts.slice(0, i).join(LABEL_SEP));
  }
  const sorted = [...all].sort((a, b) => a.localeCompare(b, "pl"));
  const rows: LabelRow[] = sorted.map((label) => ({
    label,
    depth: labelDepth(label),
    name: label.split(LABEL_SEP).pop() ?? label,
    hasChildren: sorted.some((other) => other !== label && other.startsWith(label + LABEL_SEP)),
  }));
  // Sortowanie leksykograficzne daje „a”, „a/b”, „a/c”, „ab”: poddrzewo zostaje obok rodzica.
  return rows.sort((x, y) => treeOrder(x.label, y.label));
}

/** Porządek drzewa: porównujemy segment po segmencie, więc dzieci nie mieszają się z rodzeństwem. */
function treeOrder(a: string, b: string): number {
  const pa = a.split(LABEL_SEP);
  const pb = b.split(LABEL_SEP);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const c = pa[i].localeCompare(pb[i], "pl");
    if (c !== 0) return c;
  }
  return pa.length - pb.length;
}
