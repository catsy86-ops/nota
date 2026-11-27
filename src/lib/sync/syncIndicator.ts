import type { SyncState } from "@/lib/yjsSync";
import { devicesPl } from "@/lib/plural";

export type SyncTone = "connected" | "connecting" | "offline" | "error" | "rekeyed";

const hm = (at: number) => new Date(at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

/** Stan wskaźnika z danych synchronizacji i sieci — kolejność ważności: wstrzymanie, offline, błąd, połączenie. */
export function syncTone(state: Pick<SyncState, "status" | "lastError">, online: boolean): SyncTone {
  if (state.status === "rekeyed") return "rekeyed";
  if (!online) return "offline";
  if (state.lastError) return "error";
  return state.status === "connected" ? "connected" : "connecting";
}

/** Krótki napis obok kropki (Q4.1) i pełne zdanie dla czytnika. */
export function syncIndicatorText(tone: SyncTone, peerCount: number, offlineSince: number | null): { short: string; label: string } {
  switch (tone) {
    case "connected":
      return peerCount > 0
        ? { short: `Połączono · ${devicesPl(peerCount)}`, label: `Synchronizacja: połączono, online ${devicesPl(peerCount)}` }
        : { short: "Czekam na urządzenia", label: "Synchronizacja: połączono, inne urządzenia nie są teraz online" };
    case "connecting":
      return { short: "Łączenie…", label: "Synchronizacja: łączenie" };
    case "offline": {
      const since = offlineSince ? ` od ${hm(offlineSince)}` : "";
      return { short: `Offline${since}`, label: `Synchronizacja: offline${since}, zmiany zapisują się tutaj i czekają` };
    }
    case "error":
      return { short: "Błąd synchronizacji", label: "Synchronizacja: błąd" };
    case "rekeyed":
      return { short: "Wstrzymana", label: "Synchronizacja wstrzymana: kod zmieniono na innym urządzeniu" };
  }
}

