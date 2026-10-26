import { Lock, LockOpen } from "lucide-react";
import { useVault } from "@/hooks/usePrivateNotes";
import { privateNotes } from "@/lib/privateNotes";
import { vaultUi } from "@/lib/vaultUi";
import { lockEverywhere, useAutoLockMinutes } from "@/lib/vaultAutoLock";

/**
 * Kłódka skarbca w nagłówku (2.1 planu Skarbca): zamknięta/otwarta, z podpowiedzią o auto-blokadzie.
 * Stuknięcie zablokuje skarbiec albo otworzy jego odblokowanie. Widoczna tylko, gdy skarbiec jest ustawiony.
 */
export function VaultStatusButton() {
  const vault = useVault();
  const minutes = useAutoLockMinutes();
  if (vault.phase === "none") return null;

  const open = vault.phase === "unlocked";
  const hint = open
    ? (minutes === 0 ? "Blokada tylko po zamknięciu karty" : `Blokada po ${minutes} min bezczynności`)
    : "Stuknij, aby odblokować";
  const label = open ? "Skarbiec odblokowany — stuknij, aby zablokować" : "Skarbiec zablokowany — stuknij, aby odblokować";

  return (
    <button
      type="button"
      onClick={() => (open ? void lockEverywhere(privateNotes) : vaultUi.open("unlock"))}
      aria-label={label}
      title={`${label}. ${hint}`}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {open ? <LockOpen className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
    </button>
  );
}
