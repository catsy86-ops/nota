/**
 * Kształtki zużyte na budowie (decyzja 2026-10-15: tylko sztuki, bez metrów rury).
 * Opcjonalne pole wpisu — jak protokół próby: starsza wersja aplikacji je pomija.
 * Sumy per budowa i okres idą do raportu dla szefa.
 */
export interface Fitting {
  /** Nazwa, np. „Kolano 16” — wpisywana ręcznie, z podpowiedziami. */
  name: string;
  /** Liczba sztuk (całkowita, ≥ 1). */
  qty: number;
}

export const FITTING_NAME_MAX = 40;
export const FITTING_QTY_MAX = 9999;
export const FITTINGS_MAX = 20;

/** Podpowiedzi na start, zanim pojawią się własne nazwy z poprzednich wpisów. */
export const FITTING_SUGGESTIONS = ["Kolano 16", "Trójnik 16", "Złączka 16", "Kolano naścienne 16", "Kolano 20", "Trójnik 20", "Złączka 20", "Redukcja 20/16"];

/** Klucz porównania nazw: bez wielkości liter, nadmiarowych spacji i ogonków („Kolano  16” = „kolano 16”). */
export const fittingKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

/**
 * Dowolne wejście → lista kształtek: puste nazwy i zera odpadają, liczby całkowite w zakresie,
 * powtórzona nazwa sumuje się do pierwszej pozycji. `[]` = brak kształtek.
 */
export function cleanFittings(raw: unknown): Fitting[] {
  if (!Array.isArray(raw)) return [];
  const out: Fitting[] = [];
  const at = new Map<string, number>();
  for (const r of raw) {
    const f = r as Partial<Fitting> | null;
    if (!f || typeof f !== "object" || typeof f.name !== "string" || typeof f.qty !== "number" || !Number.isFinite(f.qty)) continue;
    const name = f.name.trim().replace(/\s+/g, " ").slice(0, FITTING_NAME_MAX);
    const qty = Math.min(FITTING_QTY_MAX, Math.floor(f.qty));
    if (!name || qty < 1) continue;
    const k = fittingKey(name);
    const i = at.get(k);
    if (i !== undefined) { out[i] = { ...out[i], qty: Math.min(FITTING_QTY_MAX, out[i].qty + qty) }; continue; }
    if (out.length >= FITTINGS_MAX) continue;
    at.set(k, out.length);
    out.push({ name, qty });
  }
  return out;
}

/** Suma kształtek z wielu wpisów, od największej liczby; nazwa — pierwsza napotkana pisownia. */
export function sumFittings(lists: readonly (readonly Fitting[] | undefined)[]): Fitting[] {
  const by = new Map<string, Fitting>();
  for (const list of lists) {
    for (const f of list ?? []) {
      const k = fittingKey(f.name);
      const prev = by.get(k);
      by.set(k, prev ? { ...prev, qty: prev.qty + f.qty } : { ...f });
    }
  }
  return [...by.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "pl"));
}

/** „Kolano 16 × 4, Trójnik 16 × 2” — do listy wpisów, raportu i wiadomości. */
export const fittingsLine = (list: readonly Fitting[]) => list.map((f) => `${f.name} × ${f.qty}`).join(", ");

/**
 * Podpowiedzi nazw: najpierw używane we wpisach (od najczęstszych), potem domyślne;
 * bez tych już wpisanych w bieżącym wpisie.
 */
export function suggestFittingNames(history: readonly (readonly Fitting[] | undefined)[], taken: readonly string[] = []): string[] {
  const used = sumFittings(history).map((f) => f.name);
  const skip = new Set(taken.map(fittingKey));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of [...used, ...FITTING_SUGGESTIONS]) {
    const k = fittingKey(n);
    if (skip.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}
