import { yjsStore } from "@/lib/yjsStore";
import { getSyncState, formatCode, getSignalingServers } from "@/lib/yjsSync";
import { buildDiagReport, getDiagEntries, type DiagSnapshot } from "@/lib/diagnostics";

declare const __APP_BUILD__: string | undefined;

async function serviceWorkerState(): Promise<string> {
  if (!("serviceWorker" in navigator)) return "nieobsługiwany";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "niezarejestrowany";
    if (reg.waiting) return "czeka nowa wersja";
    return reg.active ? `aktywny (${reg.active.state})` : "instaluje się";
  } catch {
    return "niedostępny";
  }
}

async function storageInfo(): Promise<DiagSnapshot["storage"]> {
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted: persisted ?? null };
  } catch {
    return { usage: null, quota: null, persisted: null };
  }
}

export async function collectDiagReport(): Promise<string> {
  const sync = getSyncState();
  const snapshot: DiagSnapshot = {
    build: typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : "dev",
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    serviceWorker: await serviceWorkerState(),
    storage: await storageInfo(),
    ...yjsStore.diagStats(),
    sync: {
      status: sync.status,
      peerCount: sync.peerCount,
      paired: Boolean(sync.code),
      lastSyncedAt: sync.lastSyncedAt,
      lastError: sync.lastError,
      signaling: getSignalingServers(),
    },
  };
  // Kod także w postaci z Ustawień (grupy po 4) — gdyby trafił do dziennika przepisany z ekranu.
  return buildDiagReport(snapshot, getDiagEntries(), sync.code ? [sync.code, formatCode(sync.code)] : []);
}

/** Zbiera raport i pobiera go jako plik .txt. Nic nie wysyła. */
export async function downloadDiagReport(): Promise<void> {
  const text = await collectDiagReport();
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `notatnik-diagnostyka-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
