import { lazy, Suspense, useEffect } from "react";
import { privateNotes } from "@/lib/privateNotes";
import { startAutoLock } from "@/lib/vaultAutoLock";
import { useVaultUiRequest } from "@/lib/vaultUi";

// Okna skarbca ładują się dopiero przy pierwszej prośbie — start strony ich nie płaci.
const VaultDialog = lazy(() => import("@/components/vault/VaultDialogs").then((m) => ({ default: m.VaultDialog })));

/** Montowany raz w `Index`: pilnuje automatycznej blokady i rysuje okno, o które ktoś poprosił. */
export function VaultHost() {
  const req = useVaultUiRequest();
  useEffect(() => startAutoLock(privateNotes), []);
  if (!req) return null;
  return (
    <Suspense fallback={null}>
      <VaultDialog key={req.kind} kind={req.kind} onDone={req.onDone} />
    </Suspense>
  );
}
