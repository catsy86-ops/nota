import { DZIEN } from "@/lib/storage/names";
/** Klucz podsumowania ostatniej wysyłki harmonogramu (tylko to urządzenie; Ustawienia go czytają). */
export const PUSH_SUMMARY_KEY = DZIEN.pushSummary;

export interface PushSummary {
  /** Ile pozycji poszło do serwera. */
  sent: number;
  /** Ile pozycji powstałoby bez limitu. */
  total: number;
  /** Ile odpadło przy limicie `limit`. */
  dropped: number;
  limit: number;
  /** Kiedy wysłano (ms). */
  at: number;
  /** Lista obcięta: ostatni zachowany termin (ms). */
  horizonEnd?: number | null;
  /** Pominięte według kategorii (`PUSH_CATEGORIES`). */
  droppedBy?: Record<string, number>;
}

/** Odczyt podsumowania; śmieci i brak klucza → `null`. */
export function readPushSummary(raw: string | null): PushSummary | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PushSummary>;
    if (typeof v.sent !== "number" || typeof v.total !== "number" || typeof v.dropped !== "number") return null;
    if (typeof v.limit !== "number" || typeof v.at !== "number") return null;
    const horizonEnd = typeof v.horizonEnd === "number" ? v.horizonEnd : null;
    const droppedBy = v.droppedBy && typeof v.droppedBy === "object"
      ? Object.fromEntries(Object.entries(v.droppedBy).filter((e): e is [string, number] => typeof e[1] === "number" && e[1] > 0))
      : {};
    return { sent: v.sent, total: v.total, dropped: v.dropped, limit: v.limit, at: v.at, horizonEnd, droppedBy };
  } catch {
    return null;
  }
}
