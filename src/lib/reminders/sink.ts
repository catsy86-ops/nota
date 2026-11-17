import { isNativeShell } from "@/lib/native/platform";
import { createPersistedStore } from "@/lib/persistedStore";
import { uploadSchedule } from "@/lib/push/client";
import { pushPrefs } from "@/lib/push/prefs";
import type { PushItem } from "@/lib/push/schedule";

/**
 * Ujście harmonogramu przypomnień (F1.1): ta sama lista `PushItem` z `buildPushSchedule` trafia
 * albo na serwer Web Push (PWA), albo do alarmów systemowych (APK). Strona z timerami
 * (`useReminderNotifications`) nie jest ujściem — działa zawsze, gdy aplikacja jest otwarta.
 */
/** Gdzie kończy się obcięta lista (`buildPushSchedulePlan`). */
export interface ScheduleHorizon {
  horizonEnd: number | null;
  dropped: number;
}

export interface ReminderSink {
  id: "webpush" | "native";
  /** Czy ujście może teraz przyjąć listę (zgoda, subskrypcja). */
  available(): Promise<boolean>;
  /**
   * Zastępuje całą listę. `keepalive` — wysyłka przy chowaniu aplikacji. `horizon` — lista obcięta limitem
   * (S2 audytu 2): alarmy systemowe stawiają wtedy strażnika przed końcem listy.
   */
  replace(items: readonly PushItem[], keepalive?: boolean, horizon?: ScheduleHorizon): Promise<void>;
  clear(): Promise<void>;
}

export const webpushSink: ReminderSink = {
  id: "webpush",
  available: async () => pushPrefs.get().enabled,
  replace: (items, keepalive = false) => uploadSchedule([...items], keepalive),
  clear: async () => undefined, // wyłączenie robi `disablePush` (wypisuje subskrypcję na serwerze)
};

/** Alarmy systemowe w APK. Ustawienie urządzenia, poza kopią zapasową — zgodę daje system każdemu telefonowi osobno. */
export const NATIVE_ALARMS_KEY = "kaczy.alarms.v1";
export interface NativeAlarmPrefs {
  enabled: boolean;
  /** Wynik ostatniego planowania — dla Ustawień. */
  last?: { at: number; ok: boolean; count?: number; exact?: boolean; error?: string };
}
export const nativeAlarmPrefs = createPersistedStore<NativeAlarmPrefs>(NATIVE_ALARMS_KEY, { enabled: false }, {
  merge: (d, s) => (s && typeof s === "object" ? { ...d, ...s, enabled: s.enabled === true } : d),
});

/** Kod natywny wczytuje się dopiero w powłoce — PWA nie pobiera wtyczki. */
export const loadNativeSink = () => import("./nativeSink");

/** Ujście dla tego urządzenia albo `null`, gdy przypomnienia przy zamkniętej aplikacji są wyłączone. */
export async function activeSink(): Promise<ReminderSink | null> {
  if (isNativeShell()) return nativeAlarmPrefs.get().enabled ? (await loadNativeSink()).nativeSink : null;
  return pushPrefs.get().enabled ? webpushSink : null;
}

/** Czy `PushScheduleSync` ma być zamontowany (hook — reaguje na zmianę ustawień). */
export function useReminderSinkOn(): boolean {
  const push = pushPrefs.use().enabled;
  const alarms = nativeAlarmPrefs.use().enabled;
  return isNativeShell() ? alarms : push;
}
