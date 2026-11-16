import { PUSH_CATEGORIES, PUSH_HORIZON_DAYS, type PushItem } from "@/lib/push/schedule";

/**
 * Plan alarmów systemowych dla powłoki Androida (F1.2): numery, kanały, różnica względem tego,
 * co system już ma, i alarm-strażnik. Czyste funkcje — wtyczkę woła `nativeSink.ts`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Android przyjmuje numer powiadomienia jako dodatni `int`. */
const ID_MASK = 0x7fffffff;
/** Stały numer strażnika; zwykły alarm, który by na niego trafił, przesuwa się dalej. */
export const SENTINEL_ID = ID_MASK;
export const SENTINEL_KEY = "sentinel";
export const CHANNEL_PREFIX = "notki-";
export const CHANNEL_OTHER = `${CHANNEL_PREFIX}inne`;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export const alarmId = (key: string): number => fnv1a(key) & ID_MASK;

/** Kanał Androida z kategorii przypomnienia (`PUSH_CATEGORIES`) — użytkownik wycisza je osobno w systemie. */
export function channelOf(key: string): string {
  const cat = PUSH_CATEGORIES.find((c) => c.prefixes.some((p) => key.startsWith(p)));
  return cat ? `${CHANNEL_PREFIX}${cat.id}` : CHANNEL_OTHER;
}

/** Rodzaj przycisków: notatka z „Odłóż”, notatka bez, koniec zmiany albo żadne. */
export type AlarmActions = "note-snooze" | "note" | "shift-end" | undefined;

export interface NativeAlarm {
  id: number;
  key: string;
  at: number;
  title: string;
  body: string;
  url: string;
  channel: string;
  /** Skrót treści — po nim poznajemy, czy alarm zapisany w systemie jest jeszcze aktualny. */
  hash: string;
  actions: AlarmActions;
  noteId?: string;
  shiftDay?: string;
}

export interface PendingAlarm {
  id: number;
  hash?: string;
}

function actionsOf(item: PushItem): Pick<NativeAlarm, "actions" | "noteId" | "shiftDay"> {
  // Zapowiedź terminu (`…:lead`) też dostaje „Gotowe” — jak w `public/sw-notifications.js`.
  if (item.key.startsWith("n:")) {
    const noteId = item.key.split(":")[1] ?? "";
    return noteId ? { actions: item.snooze ? "note-snooze" : "note", noteId } : { actions: undefined };
  }
  if (/^s:\d{4}-\d{2}-\d{2}$/.test(item.key)) return { actions: "shift-end", shiftDay: item.key.slice(2) };
  return { actions: undefined };
}

/**
 * Numery z kluczy. Dwa klucze mogą dać ten sam skrót: wtedy późniejszy w kolejności alfabetycznej
 * dostaje następny wolny numer. Kolejność jest stała, więc ten sam zestaw daje zawsze te same numery
 * (inaczej różnica kasowałaby i planowała te same alarmy przy każdym przebiegu).
 */
export function toAlarms(items: readonly PushItem[]): NativeAlarm[] {
  const taken = new Set<number>([SENTINEL_ID]);
  const seen = new Set<string>();
  const out: NativeAlarm[] = [];
  for (const item of [...items].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    let id = alarmId(item.key);
    while (taken.has(id)) id = (id + 1) & ID_MASK;
    taken.add(id);
    out.push({
      id, key: item.key, at: item.at, title: item.title, body: item.body, url: item.url,
      channel: channelOf(item.key),
      hash: fnv1a(JSON.stringify([item.key, item.at, item.title, item.body, item.url, item.snooze === true])).toString(36),
      ...actionsOf(item),
    });
  }
  return out;
}

/**
 * Strażnik: lista sięga tylko `PUSH_HORIZON_DAYS` naprzód i odnawia się przy otwarciu aplikacji.
 * Gdy terminy dochodzą do końca horyzontu (seria albo wypełniony Grafik), dzień przed końcem
 * przychodzi prośba o otwarcie aplikacji — inaczej dalsze przypomnienia po cichu by przepadły.
 */
export function sentinelFor(alarms: readonly NativeAlarm[], now: number): NativeAlarm | null {
  const end = now + PUSH_HORIZON_DAYS * DAY_MS;
  if (!alarms.some((a) => a.at > end - 2 * DAY_MS)) return null;
  // Do pełnej godziny: strażnik liczony co przebieg miałby inny czas i byłby planowany od nowa.
  const at = Math.floor((end - DAY_MS) / 3_600_000) * 3_600_000;
  return {
    id: SENTINEL_ID, key: SENTINEL_KEY, at,
    title: "Otwórz NOTKI, żeby przypomnienia działały dalej",
    body: "Alarmy są zaplanowane na 14 dni. Otwarcie aplikacji planuje kolejne.",
    url: "/", channel: CHANNEL_OTHER, hash: `s${at.toString(36)}`, actions: undefined,
  };
}

export interface NativePlan {
  cancel: number[];
  schedule: NativeAlarm[];
}

/** Różnica: kasujemy to, czego już nie ma albo co się zmieniło; planujemy tylko nowe i zmienione. */
export function planNative(items: readonly PushItem[], pending: readonly PendingAlarm[], now: number): NativePlan {
  const alarms = toAlarms(items).filter((a) => a.at > now);
  const sentinel = sentinelFor(alarms, now);
  const wanted = sentinel ? [...alarms, sentinel] : alarms;
  const byId = new Map(wanted.map((a) => [a.id, a]));
  const kept = new Set<number>();
  const cancel: number[] = [];
  for (const p of pending) {
    const want = byId.get(p.id);
    if (want && want.hash === p.hash && !kept.has(p.id)) kept.add(p.id);
    else if (!cancel.includes(p.id)) cancel.push(p.id);
  }
  return { cancel, schedule: wanted.filter((a) => !kept.has(a.id)) };
}
