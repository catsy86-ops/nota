import { useSyncExternalStore } from "react";
import { privateNotes, type VaultSnapshot } from "@/lib/privateNotes";

/** Stan skarbca (none / locked / unlocked / locking). */
export function useVault(): VaultSnapshot {
  return useSyncExternalStore(privateNotes.subscribe, privateNotes.getSnapshot);
}
