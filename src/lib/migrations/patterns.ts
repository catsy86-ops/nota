import * as Y from "yjs";

/**
 * Wzorce migracji w CRDT (D2.5, `docs/plan-migracje-yjs-2026-11-15.md`) — do użycia w `run` migracji z rejestru.
 * Wszystkie spełniają zasadę 2: tylko dopisują, niczego nie usuwają ani nie zmieniają znaczenia istniejącego pola,
 * więc starszy klient czyta dalej to, co znał, a migracja powtórzona na innym urządzeniu daje ten sam wynik.
 * Reguła D2.6: pole o nowym znaczeniu albo jednostce dostaje nową nazwę — nigdy nie przepisuje się starego.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Y.AbstractType);

/** Zmiana nazwy pola: kopiuje `from` → `to` tam, gdzie `to` jeszcze nie ma; `from` zostaje dla starszych klientów. */
export function copyField(map: Y.Map<unknown>, from: string, to: string): number {
  let n = 0;
  map.forEach((v, k) => {
    if (isObj(v) && v[from] !== undefined && v[to] === undefined) {
      map.set(k, { ...v, [to]: v[from] });
      n++;
    }
  });
  return n;
}

/** Czytanie po zmianie nazwy: nowe wygrywa, stare jako zapas (wpis od starszego klienta ma tylko stare). */
export function readRenamed<T = unknown>(entry: Obj, from: string, to: string): T | undefined {
  return (entry[to] ?? entry[from]) as T | undefined;
}

/** Zmiana jednostki: nowe pole liczone ze starego (`convert`), stare zostaje bez zmian. */
export function deriveField(map: Y.Map<unknown>, from: string, to: string, convert: (v: unknown) => unknown): number {
  let n = 0;
  map.forEach((v, k) => {
    if (!isObj(v) || v[to] !== undefined || v[from] === undefined) return;
    const next = convert(v[from]);
    if (next === undefined) return;
    map.set(k, { ...v, [to]: next });
    n++;
  });
  return n;
}

/**
 * Zwykły obiekt → `Y.Map` pól (wzór z Pracy): wpis-obiekt z mapy `src` trafia jako `Y.Map` pod tym samym
 * identyfikatorem (z danych, nie losowym) do mapy `dst`. Źródło zostaje dla starszych klientów; wpis już
 * obecny w `dst` nie jest nadpisywany (dwa urządzenia migrujące równolegle tworzą ten sam klucz — wygrywa jeden,
 * treść jest ta sama).
 */
export function objectsToFieldMaps(src: Y.Map<unknown>, dst: Y.Map<unknown>): number {
  let n = 0;
  src.forEach((v, k) => {
    if (!isObj(v) || dst.has(k)) return;
    const fields = new Y.Map<unknown>();
    for (const [f, val] of Object.entries(v)) if (val !== undefined) fields.set(f, val);
    dst.set(k, fields);
    n++;
  });
  return n;
}

/** Podział mapy: wpisy spełniające `pick` kopiowane do `dst` (bez usuwania ze źródła). */
export function splitInto(src: Y.Map<unknown>, dst: Y.Map<unknown>, pick: (value: unknown, key: string) => boolean): number {
  let n = 0;
  src.forEach((v, k) => {
    if (!dst.has(k) && pick(v, k)) {
      dst.set(k, isObj(v) ? { ...v } : v);
      n++;
    }
  });
  return n;
}

/** Scalanie map: wpisy z kolejnych źródeł do `dst`, pierwszy wygrywa przy tym samym kluczu; źródła zostają. */
export function mergeInto(sources: readonly Y.Map<unknown>[], dst: Y.Map<unknown>): number {
  let n = 0;
  for (const src of sources) {
    src.forEach((v, k) => {
      if (dst.has(k)) return;
      dst.set(k, isObj(v) ? { ...v } : v);
      n++;
    });
  }
  return n;
}
