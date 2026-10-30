import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { applyAppearanceValues, codeFromHash, decodeAppearance, snapshotAppearance } from "@/lib/appearanceCode";
import { toastWithUndo } from "@/lib/undoToast";

/**
 * Link `#wyglad=NOTKI1-…` (plan motywów 1.5): po wejściu pyta, czy wczytać wygląd. Bez zgody nic się nie
 * zmienia; fragment zawsze znika z adresu, żeby odświeżenie nie pytało ponownie.
 */
export function AppearanceLinkImport() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const found = codeFromHash(window.location.hash);
    if (!found) return;
    setCode(found);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  function accept() {
    if (!code) return;
    const values = decodeAppearance(code);
    setCode(null);
    if (!values) return;
    const before = snapshotAppearance();
    applyAppearanceValues(values, { replace: false });
    toastWithUndo("Wczytano wygląd z linku", () => applyAppearanceValues(before, { replace: true }));
  }

  return (
    <AlertDialog open={code !== null} onOpenChange={(o) => { if (!o) setCode(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Wczytać wygląd z linku?</AlertDialogTitle>
          <AlertDialogDescription>
            Ktoś wysłał Ci wygląd NOTKI. Wczytanie zmieni styl, jasność, akcent i resztę wyglądu na tym urządzeniu.
            Notatki i dane nie zmienią się. Zmianę cofniesz z komunikatu.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Nie, zostaw</AlertDialogCancel>
          <AlertDialogAction onClick={accept}>Wczytaj wygląd</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
