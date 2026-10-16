import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Powiadomienia przy zamkniętej aplikacji (Web Push przez własny serwer `push-server/`).
 * Ustawienie urządzenia (localStorage), nie dokumentu Yjs: subskrypcja należy do tej
 * przeglądarki, a dwa telefony z tym samym harmonogramem dostałyby każde przypomnienie dwa razy.
 */
export const PUSH_PREFS_KEY = "kaczy.push.v1";

export interface PushSyncResult {
  at: number;
  ok: boolean;
  /** Liczba zaplanowanych terminów (przy `ok`). */
  count?: number;
  error?: string;
}

export interface PushPrefs {
  /** Adres serwera bez końcowego „/” („https://push.example.com”). */
  server: string;
  enabled: boolean;
  /** Skrót ostatnio wysłanej listy — bez zmian nie wysyłamy jej ponownie. */
  sentHash?: string;
  last?: PushSyncResult;
}

export const pushPrefs = createPersistedStore<PushPrefs>(PUSH_PREFS_KEY, { server: "", enabled: false }, {
  merge: (d, s) => (s && typeof s === "object" ? { ...d, ...s, enabled: s.enabled === true && typeof s.server === "string" && s.server !== "" } : d),
});

export const updatePushPrefs = (patch: Partial<PushPrefs>) => pushPrefs.set({ ...pushPrefs.get(), ...patch });

/** Adres serwera: https albo http na localhost; bez ścieżki zapytania i końcowego „/”. `null` = błędny. */
export function normalizePushServer(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  let u: URL;
  try { u = new URL(/^[a-z]+:\/\//i.test(t) ? t : `https://${t}`); } catch { return null; }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
}
