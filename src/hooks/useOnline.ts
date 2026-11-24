import { useSyncExternalStore } from "react";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

/** Czy przeglądarka jest online (`navigator.onLine`, zdarzenia `online`/`offline`); bez okna — `true`. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
