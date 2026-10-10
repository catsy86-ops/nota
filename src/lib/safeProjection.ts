/**
 * Granica zaufania dla danych z dokumentu Yjs. Dokument może zawierać wartości
 * od innego urządzenia (P2P), z pliku sync albo ze starej wersji aplikacji —
 * `Y.Map` nie ma schematu, więc peer może wpisać pod `title` liczbę, pod
 * `labels` tablicę obiektów, pod `color` dowolny napis. Rzutowanie `as string`
 * niczego nie sprawdza, a obiekt wyrenderowany jako dziecko Reacta wywraca UI
 * (i wraca po każdym przeładowaniu, bo siedzi w dokumencie).
 *
 * Te funkcje są *tolerancyjne*: zły typ daje wartość domyślną, a nie wyjątek —
 * projekcja nigdy nie rzuca. Czysty moduł, bez zależności od Yjs ani Reacta.
 */

export const NOTE_COLORS = ["default", "coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"] as const;
export const PRIORITIES = ["none", "low", "medium", "high"] as const;
export const REMINDER_REPEATS = ["none", "daily", "weekly", "monthly"] as const;

/** Twarde sufity długości pól tekstowych z dokumentu (obrona przed rozdmuchanym stanem, nie limit UX). */
export const REMOTE_LIMITS = {
  title: 20_000,
  label: 500,
  labels: 200,
  imageRefs: 200,
  imageRef: 200,
  folderName: 2_000,
  emoji: 32,
  checklistItems: 2_000,
  checklistText: 20_000,
  id: 200,
  vault: 5_000_000,
} as const;

export function safeString(v: unknown, fallback = "", max = Infinity): string {
  if (typeof v !== "string") return fallback;
  return v.length > max ? v.slice(0, max) : v;
}

export function safeNullableString(v: unknown, max = Infinity): string | null {
  return typeof v === "string" ? (v.length > max ? v.slice(0, max) : v) : null;
}

export function safeBool(v: unknown): boolean {
  return v === true;
}

export function safeNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function safeNullableNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function safeOptionalNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function safeEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function safeOptionalEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Tablica napisów: elementy innego typu odpadają, długość i liczba elementów są obcięte. */
export function safeStringArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    out.push(item.length > maxLen ? item.slice(0, maxLen) : item);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Dzień miesiąca 1–31 albo `undefined`. */
export function safeReminderDay(v: unknown): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 31 ? v : undefined;
}

/** `YYYY-MM-DD` albo `undefined`. */
export function safeDailyDate(v: unknown): string | undefined {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}
