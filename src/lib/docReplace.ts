import { announceDocReplace, writeReplaceIntent, type ReplaceIntent } from "@/lib/docReplaceCore";
import { saveBeforeReplace } from "@/lib/dailySnapshot";
import { yjsStore } from "@/lib/yjsStore";
import { forgetPairing, getSyncState } from "@/lib/yjsSync";
import { clearRelayState } from "@/lib/sync/relayRuntime";

/**
 * Zlecenie wymiany całego dokumentu — ścieżka awaryjna (Z-16.1B, `docs/plan-dane-lokalne.md` §1.6), część przed
 * przeładowaniem. Sama wymiana dzieje się przy następnym starcie (`docReplaceCore.performDocReplace`).
 */

export interface ReplaceDeps {
  /** Kopia bieżącego stanu poza rotacją; rzuca, gdy się nie udała. */
  saveBefore: () => Promise<string>;
  inGroup: () => boolean;
  leaveGroup: () => void;
  clearRelay: () => Promise<void>;
  writeIntent: (intent: ReplaceIntent) => boolean;
  announce: () => void;
  reload: () => void;
  now?: () => number;
}

export type ReplaceRequest =
  | { kind: "snapshot"; file: string; createdAt: number }
  | { kind: "empty"; join: string; v3?: boolean };

/**
 * Kolejność (§1.6):
 * 1. kopia bieżącego stanu (`kopie-przed-przywroceniem/`, 30 dni) — bez niej nic dalej;
 * 2. zamiar w `localStorage` i nowe pokolenie dokumentu (karty ze starym pokoleniem nie wymieniają stanu) — przed
 *    wyjściem z grupy: nieudany zapis zamiaru nie zmienia niczego;
 * 3. wyjście z grupy i wyczyszczenie kolejek przekaźnika — inaczej pierwsze połączenie scaliłoby stan grupy
 *    i cofnęło wymianę (kolejki czyszczone też przy starcie, po przeładowaniu innych kart);
 * 4. sygnał do pozostałych kart, przeładowanie.
 */
export async function requestDocReplace(req: ReplaceRequest, deps: ReplaceDeps = browserDeps): Promise<{ before: string; leftGroup: boolean }> {
  const before = await deps.saveBefore();
  const leftGroup = deps.inGroup();
  const startedAt = (deps.now ?? Date.now)();
  const intent: ReplaceIntent = req.kind === "snapshot"
    ? { kind: "snapshot", file: req.file, createdAt: req.createdAt, startedAt, leftGroup }
    : { kind: "empty", join: req.join, ...(req.v3 ? { v3: true } : {}), startedAt };
  if (!deps.writeIntent(intent)) throw new Error("Nie udało się zapisać zamiaru wymiany danych");
  if (leftGroup) {
    deps.leaveGroup();
    await deps.clearRelay().catch(() => undefined);
  }
  deps.announce();
  deps.reload();
  return { before, leftGroup };
}

const browserDeps: ReplaceDeps = {
  saveBefore: () => saveBeforeReplace({
    encode: () => yjsStore.encodeSyncState(),
    stateVector: () => yjsStore.encodeStateVector(),
    notes: () => yjsStore.notesMap.size,
  }),
  inGroup: () => getSyncState().code !== null,
  leaveGroup: forgetPairing,
  clearRelay: clearRelayState,
  writeIntent: writeReplaceIntent,
  announce: announceDocReplace,
  reload: () => window.location.reload(),
};
