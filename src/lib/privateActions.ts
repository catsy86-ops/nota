import { toast } from "sonner";
import { privateNotes } from "@/lib/privateNotes";
import { vaultUi } from "@/lib/vaultUi";
import { getSyncState } from "@/lib/yjsSync";

/**
 * Akcje „Zablokuj / Zdejmij blokadę” wywoływane z menu notatki i palety.
 * Dbają o to, żeby przed operacją skarbiec istniał i był odblokowany —
 * jeśli nie, otwierają odpowiednie okno i wracają do akcji po sukcesie.
 */
export async function lockNoteFlow(id: string): Promise<void> {
  const phase = privateNotes.phase();
  if (phase === "none") { vaultUi.open("setup", () => void lockNoteFlow(id)); return; }
  if (phase !== "unlocked") { vaultUi.open("unlock", () => void lockNoteFlow(id)); return; }

  const res = await privateNotes.lockNote(id);
  if (res.ok) {
    const synced = getSyncState().code !== null;
    toast.success("Notatka zablokowana", {
      description: synced
        ? "Jest teraz jednym zaszyfrowanym blokiem. Edycja na dwóch urządzeniach naraz nie scala zmian — wygra ostatni zapis."
        : "Treść jest zaszyfrowana hasłem skarbca.",
    });
    return;
  }
  if (res.reason === "has-files") {
    toast.error("Nie można zablokować notatki z plikami", {
      description: "Obrazy i załączniki nie są szyfrowane. Usuń je z notatki albo przenieś do osobnej notatki, a potem zablokuj.",
    });
  } else if (res.reason === "changed") {
    toast.error("Notatka zmieniła się w trakcie blokowania", { description: "Spróbuj jeszcze raz." });
  } else if (res.reason === "session-locked") {
    vaultUi.open("unlock", () => void lockNoteFlow(id));
  } else {
    toast.error("Nie udało się zablokować notatki");
  }
}

export async function removeLockFlow(id: string): Promise<void> {
  const phase = privateNotes.phase();
  if (phase !== "unlocked") { vaultUi.open("unlock", () => void removeLockFlow(id)); return; }
  const ok = await privateNotes.removeLock(id);
  if (ok) toast.success("Zdjęto blokadę", { description: "Notatka jest znowu zwykłym, jawnym tekstem — widać ją w wyszukiwarce i kopiach zapasowych." });
  else toast.error("Nie udało się zdjąć blokady", { description: "Odblokuj skarbiec i spróbuj jeszcze raz." });
}
