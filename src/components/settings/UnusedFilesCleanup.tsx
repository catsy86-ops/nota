import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { pluralPl } from "@/lib/plural";
import { Section } from "./SettingsShared";

const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const filesPl = (n: number) => `${n} ${pluralPl(n, ["plik", "pliki", "plików"])}`;

/**
 * Z-6.6: „Usuń nieużywane pliki (N)” — zdjęcia i załączniki, do których nic się już nie odwołuje (np. po usunięciu
 * notatki z Kosza), a automatyczne sprzątanie je zostawiło. Najpierw sprawdzenie (liczba i rozmiar), potem potwierdzenie.
 */
export function UnusedFilesCleanup() {
  const [found, setFound] = useState<{ count: number; bytes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function scan() {
    setBusy(true);
    try {
      const { scanUnusedFiles } = await import("@/lib/fileCleanup");
      setFound(await scanUnusedFiles());
    } catch {
      toast.error("Nie udało się sprawdzić plików");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setConfirm(false);
    setBusy(true);
    try {
      const { removeUnusedFiles } = await import("@/lib/fileCleanup");
      const n = await removeUnusedFiles();
      toast.success(n > 0 ? `Usunięto ${filesPl(n)}` : "Nie było czego usuwać");
      setFound({ count: 0, bytes: 0 });
    } catch {
      toast.error("Nie udało się usunąć plików");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Nieużywane pliki">
      <p className="ui-hint mb-2">
        Zdjęcia i załączniki, których nie używa już żadna notatka ani wpis w Pracy. Pliki z ostatnich 7 dni zostają — mogą
        wrócić przez „Cofnij” albo z innego urządzenia.
      </p>
      {found === null ? (
        <Button size="sm" variant="outline" className="w-full" onClick={scan} loading={busy}>Sprawdź nieużywane pliki</Button>
      ) : found.count === 0 ? (
        <p className="ui-meta" data-testid="unused-files-result">Brak nieużywanych plików.</p>
      ) : (
        <Button size="sm" variant="outline" className="w-full" onClick={() => setConfirm(true)} loading={busy} data-testid="unused-files-remove">
          Usuń nieużywane pliki ({found.count}, {sizeText(found.bytes)})
        </Button>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć {found ? filesPl(found.count) : "pliki"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Żadna notatka ani wpis ich nie używa. Usunięcie zwolni {found ? sizeText(found.bytes) : ""} na tym urządzeniu i nie da się go cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zostaw</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Usuń pliki</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
