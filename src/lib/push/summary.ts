/** Klucz podsumowania ostatniej wysyłki harmonogramu (tylko to urządzenie; Ustawienia go czytają). */
export const PUSH_SUMMARY_KEY = "kaczy.push.summary.v1";

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
}

/** Odczyt podsumowania; śmieci i brak klucza → `null`. */
export function readPushSummary(raw: string | null): PushSummary | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PushSummary>;
    if (typeof v.sent !== "number" || typeof v.total !== "number" || typeof v.dropped !== "number") return null;
    if (typeof v.limit !== "number" || typeof v.at !== "number") return null;
    return { sent: v.sent, total: v.total, dropped: v.dropped, limit: v.limit, at: v.at };
  } catch {
    return null;
  }
}
