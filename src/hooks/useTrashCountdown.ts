import { useState, useEffect, RefObject } from "react";
import { formatTrashCountdownLabel, type TrashCountdownLocale } from "@/lib/trashCountdownLabels";
import { subscribeHourlyTick } from "@/lib/hourlyTicker";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface TrashCountdown {
  days: number;
  urgent: boolean;
  label: string;
}

function computeCountdown(trashedAt: number, locale: TrashCountdownLocale): TrashCountdown {
  const remainingMs = trashedAt + THIRTY_DAYS_MS - Date.now();
  const days = Math.max(0, Math.ceil(remainingMs / ONE_DAY_MS));
  const urgent = days <= 3;
  return { days, urgent, label: formatTrashCountdownLabel(days, locale) };
}

/**
 * Returns the days remaining before a trashed note is auto-deleted.
 *
 * Refresh strategy:
 * - All instances share a single module-level hourly timer (see hourlyTicker.ts)
 *   instead of each NoteCard owning its own setInterval.
 * - When `observeRef` is provided, the hook only subscribes while the element
 *   is visible (IntersectionObserver), so off-screen cards add zero overhead.
 *
 * Label text comes from `formatTrashCountdownLabel` — the single source of
 * truth for translations.
 */
export function useTrashCountdown(
  trashedAt: number | null | undefined,
  observeRef?: RefObject<Element | null>,
  locale: TrashCountdownLocale = "pl"
): TrashCountdown | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!trashedAt) return;

    const onTick = () => setTick((t) => t + 1);

    let unsubscribe: (() => void) | null = null;
    const subscribe = () => {
      if (unsubscribe) return;
      unsubscribe = subscribeHourlyTick(onTick);
      // Refresh immediately so the label is current right after (re)subscribing.
      onTick();
    };
    const unsub = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    const el = observeRef?.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      subscribe();
      return () => unsub();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) subscribe();
        else unsub();
      },
      { threshold: 0 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      unsub();
    };
  }, [trashedAt, observeRef]);

  if (!trashedAt) return null;
  return computeCountdown(trashedAt, locale);
}
