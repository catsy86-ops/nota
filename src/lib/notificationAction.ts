/**
 * Akcja z powiadomienia przypomnienia przy zamkniętej aplikacji. Service worker
 * (`public/sw-notifications.js`) nie może zmienić dokumentu Yjs, więc otwiera
 * `/notatka/<id>?akcja=done|snooze10`, a strona wykonuje akcję po wczytaniu notatek.
 */
export type NotificationAction = "done" | "snooze10";

export interface PendingAction {
  noteId: string;
  action: NotificationAction;
}

export function parsePendingAction(pathname: string, search: string): PendingAction | null {
  const action = new URLSearchParams(search).get("akcja");
  if (action !== "done" && action !== "snooze10") return null;
  const m = pathname.match(/^\/notatka\/([^/]+)\/?$/);
  if (!m) return null;
  try {
    return { noteId: decodeURIComponent(m[1]), action };
  } catch {
    return null;
  }
}

/** Adres bez parametru `akcja` — żeby odświeżenie nie wykonało jej drugi raz. */
export function withoutActionParam(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("akcja");
  const s = params.toString();
  return s ? `?${s}` : "";
}
