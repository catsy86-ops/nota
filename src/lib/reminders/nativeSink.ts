import { LocalNotifications, type ActionPerformed } from "@capacitor/local-notifications";
import { logDiag } from "@/lib/diagnostics";
import { PUSH_CATEGORIES } from "@/lib/push/schedule";
import { yjsStore } from "@/lib/yjsStore";
import { CHANNEL_OTHER, CHANNEL_PREFIX, planNative, type NativeAlarm, type PendingAlarm } from "./nativePlan";
import { nativeAlarmPrefs, type ReminderSink, type ScheduleHorizon } from "./sink";

/**
 * Alarmy systemowe Androida przez `@capacitor/local-notifications` (F1.2). Ten plik wczytuje się
 * tylko w powłoce (`loadNativeSink`). Przypomnienie przychodzi bez serwera i bez sieci, także po
 * restarcie telefonu (wtyczka odtwarza alarmy sama); chwile są bezwzględne, więc zmiana strefy
 * ich nie przesuwa, a lista i tak przelicza się przy każdym otwarciu aplikacji.
 */

/** Kanały ważne (dźwięk i dymek): terminy umówione co do minuty. Reszta przychodzi cicho na pasek. */
const LOUD = new Set(["notatki", "grafik", "proby"]);

let prepared: Promise<void> | null = null;

/** Kanały, przyciski i obsługa stuknięcia — raz na uruchomienie. Kanału nie da się potem zmienić z kodu, tylko w systemie. */
function prepare(): Promise<void> {
  return (prepared ??= (async () => {
    for (const c of PUSH_CATEGORIES) {
      await LocalNotifications.createChannel({
        id: `${CHANNEL_PREFIX}${c.id}`,
        name: c.label,
        importance: LOUD.has(c.id) ? 4 : 3,
        // Notatki na zablokowanym ekranie bez tytułu — tytuł bywa prywatny.
        visibility: c.id === "notatki" ? 0 : 1,
        vibration: true,
      });
    }
    await LocalNotifications.createChannel({ id: CHANNEL_OTHER, name: "Pozostałe", importance: 3, visibility: 1 });
    await LocalNotifications.registerActionTypes({
      types: [
        { id: "note-snooze", actions: [{ id: "snooze10", title: "Odłóż 10 min" }, { id: "done", title: "Gotowe" }] },
        { id: "note", actions: [{ id: "done", title: "Gotowe" }] },
        { id: "shift-end", actions: [{ id: "shift-done", title: "Skończyłem" }] },
      ],
    });
    await LocalNotifications.addListener("localNotificationActionPerformed", (e) => { void onAction(e); });
  })().catch((e) => {
    prepared = null;
    throw e;
  }));
}

/** Tylko ścieżka w obrębie aplikacji — jak w `public/sw-notifications.js`. */
const safeUrl = (u: unknown): string => (typeof u === "string" && /^\/(?![/\\])/.test(u) ? u : "/");

/**
 * Stuknięcie i przyciski. Akcje idą tą samą drogą co z service workera: jako wiadomość, której
 * słuchają `useReminderNotifications`, `useShiftEndAction` i `useViewRoute`. Bez kontenera workera
 * (stary WebView) aplikacja wczytuje się pod adresem z `?akcja=…` i wykonuje ją po starcie.
 */
async function onAction(e: ActionPerformed): Promise<void> {
  // Stuknięcie przy zamkniętej aplikacji przychodzi zaraz po starcie: czekamy na dane i na pierwsze
  // malowanie z notatkami, inaczej „Gotowe” nie znalazłoby jeszcze notatki.
  await yjsStore.ready();
  await new Promise((r) => setTimeout(r, 300));
  const extra = (e.notification.extra ?? {}) as { url?: unknown; noteId?: unknown; shiftDay?: unknown };
  const url = safeUrl(extra.url);
  const action = e.actionId === "tap" ? "" : e.actionId;
  const sw = navigator.serviceWorker as ServiceWorkerContainer | undefined;
  const post = (data: unknown) => sw?.dispatchEvent(new MessageEvent("message", { data }));
  if (action === "shift-done" && typeof extra.shiftDay === "string") {
    if (sw) post({ type: "shift-action", action, dayKey: extra.shiftDay });
    else window.location.assign(`/grafik?akcja=shift-done&dzien=${encodeURIComponent(extra.shiftDay)}`);
    return;
  }
  if (action && typeof extra.noteId === "string") {
    if (sw) post({ type: "notification-action", action, noteId: extra.noteId });
    else window.location.assign(`${url}${url.includes("?") ? "&" : "?"}akcja=${encodeURIComponent(action)}`);
    return;
  }
  if (sw) post({ type: "open-url", url });
  else window.location.assign(url);
}

const toNotification = (a: NativeAlarm) => ({
  id: a.id,
  title: a.title,
  body: a.body,
  channelId: a.channel,
  actionTypeId: a.actions,
  // `allowWhileIdle`: alarm budzi telefon także w trybie uśpienia (Doze).
  schedule: { at: new Date(a.at), allowWhileIdle: true },
  extra: { key: a.key, url: a.url, h: a.hash, noteId: a.noteId, shiftDay: a.shiftDay },
});

async function pendingAlarms(): Promise<PendingAlarm[]> {
  const { notifications } = await LocalNotifications.getPending();
  return notifications.map((n) => {
    const h = (n.extra as { h?: unknown } | null | undefined)?.h;
    return { id: n.id, hash: typeof h === "string" ? h : undefined };
  });
}

async function granted(): Promise<boolean> {
  return (await LocalNotifications.checkPermissions()).display === "granted";
}

/** Przebiegi jeden po drugim: dwa naraz czytałyby tę samą listę oczekujących i planowały podwójnie. */
let queue: Promise<void> = Promise.resolve();

async function replaceNow(items: Parameters<ReminderSink["replace"]>[0], horizon?: ScheduleHorizon): Promise<void> {
  try {
    if (!(await granted())) {
      nativeAlarmPrefs.set({ ...nativeAlarmPrefs.get(), last: { at: Date.now(), ok: false, error: "Brak zgody na powiadomienia — włącz je w ustawieniach telefonu." } });
      return;
    }
    await prepare();
    const plan = planNative(items, await pendingAlarms(), Date.now(), horizon);
    if (plan.cancel.length) await LocalNotifications.cancel({ notifications: plan.cancel.map((id) => ({ id })) });
    if (plan.schedule.length) await LocalNotifications.schedule({ notifications: plan.schedule.map(toNotification) });
    const exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted";
    nativeAlarmPrefs.set({ ...nativeAlarmPrefs.get(), last: { at: Date.now(), ok: true, count: items.length, exact } });
  } catch (e) {
    logDiag("error", "alarms", "planowanie alarmów nieudane", e);
    nativeAlarmPrefs.set({ ...nativeAlarmPrefs.get(), last: { at: Date.now(), ok: false, error: "Nie udało się zaplanować alarmów." } });
  }
}

export const nativeSink: ReminderSink = {
  id: "native",
  // Przy okazji podpina obsługę stuknięć — wołane zaraz po starcie (`PushScheduleSync`).
  available: () => granted().then(async (ok) => { if (ok) await prepare(); return ok; }).catch(() => false),
  replace(items, _keepalive, horizon) {
    const run = queue.then(() => replaceNow(items, horizon));
    queue = run;
    return run;
  },
  async clear() {
    await queue;
    const pending = await pendingAlarms();
    if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(({ id }) => ({ id })) });
  },
};

/** Włączenie z Ustawień: prośba o zgodę (Android 13+), potem `PushScheduleSync` planuje listę. */
export async function enableNativeAlarms(): Promise<void> {
  const state = (await LocalNotifications.requestPermissions()).display;
  if (state !== "granted") throw new Error("Brak zgody na powiadomienia. Włącz je w ustawieniach telefonu: Aplikacje → NOTKI → Powiadomienia.");
  await prepare();
  nativeAlarmPrefs.set({ enabled: true });
}

export async function disableNativeAlarms(): Promise<void> {
  nativeAlarmPrefs.set({ enabled: false });
  await nativeSink.clear();
}

/** Próbny alarm za minutę — sprawdza zgodę, kanał i dokładność przy zamkniętej aplikacji. */
export async function scheduleTestAlarm(): Promise<void> {
  await prepare();
  await LocalNotifications.schedule({
    notifications: [{
      id: 1, title: "Próbny alarm NOTKI", body: "Alarmy działają także przy zamkniętej aplikacji.",
      channelId: `${CHANNEL_PREFIX}notatki`, schedule: { at: new Date(Date.now() + 60_000), allowWhileIdle: true }, extra: { url: "/" },
    }],
  });
}
