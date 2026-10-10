import { useSyncExternalStore } from "react";

/**
 * Prośba o okno skarbca (ustawienie hasła, odblokowanie, zmiana hasła).
 * Jedno miejsce, bo kafelek, menu notatki, paleta i Ustawienia chcą tego samego
 * okna; `VaultDialogHost` (montowany raz w Index) je rysuje.
 */
export type VaultUiKind = "setup" | "unlock" | "change" | "recover";

export interface VaultUiRequest {
  kind: VaultUiKind;
  /** Wołane po udanym zakończeniu (np. „zablokuj tę notatkę” po odblokowaniu). */
  onDone?: () => void;
}

let current: VaultUiRequest | null = null;
const listeners = new Set<() => void>();

function set(next: VaultUiRequest | null) {
  current = next;
  listeners.forEach((l) => l());
}

export const vaultUi = {
  open: (kind: VaultUiKind, onDone?: () => void) => set({ kind, onDone }),
  close: () => set(null),
  get: () => current,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useVaultUiRequest(): VaultUiRequest | null {
  return useSyncExternalStore(vaultUi.subscribe, vaultUi.get);
}
