import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Note, useNotes } from "@/hooks/useNotes";
import { importFromJSON } from "@/lib/exportNotes";
import { yjsStore } from "@/lib/yjsStore";
import { toastWithUndo } from "@/lib/undoToast";
import { pluralPl } from "@/lib/plural";
import { parseShareParam } from "@/lib/shareLink";
import { logSecurity } from "@/lib/diagnostics";
import type { ImportPlan } from "@/lib/import";
import { LAUNCH_FILES_EVENT, takeLaunchFiles } from "@/lib/fileLaunch";

type AddNote = ReturnType<typeof useNotes>["addNote"];

/** Import-from-JSON flow, plus one-shot handling of a `?share=` note-import link. */
export function useImportExport(importNotes: (notes: Note[]) => void, addNote: AddNote) {
  const handleImport = useCallback(async () => {
    try {
      const imported = await importFromJSON();
      importNotes(imported);
      toast.success(`Zaimportowano ${imported.length} notatek`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      if (message !== "Nie wybrano pliku") {
        toast.error("Błąd importu: " + (message || "Nieznany błąd"));
      }
    }
  }, [importNotes]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get("share");
    if (shareData) {
      // Adres to wejście z zewnątrz: kształt i rozmiary sprawdza `parseShareParam`.
      const shared = parseShareParam(shareData);
      if (shared) {
        addNote(shared.title, shared.content, shared.color, shared.labels, null, [], shared.checklist);
        toast.success("Zaimportowano udostępnioną notatkę!");
      } else {
        logSecurity("rejected-share-link", "link ?share= odrzucony (zły kształt lub rozmiar)");
        toast.error("Nieprawidłowy link udostępniania");
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [addNote]);

  return { handleImport };
}

/** Zdarzenie otwierające okno importu z Google Keep / Markdown (wysyła menu Import/Eksport). */
export const OPEN_EXTERNAL_IMPORT_EVENT = "kaczy:import-external";

export type ExternalImportStage = "pick" | "reading" | "summary" | "saving";

/**
 * Import z Google Keep (Takeout: .json/.html/.zip) i z plików Markdown (też Obsidian).
 * Trzy kroki: wybór plików → podsumowanie planu (jeszcze nic nie zapisano) → zapis
 * z dymkiem „Cofnij”. Cała logika importu ładuje się dopiero tutaj (osobny chunk).
 */
export function useExternalImport() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<ExternalImportStage>("pick");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Numer „rundy” — odpowiedź z zamkniętego lub zastąpionego okna jest ignorowana. */
  const runRef = useRef(0);

  const reset = useCallback(() => {
    runRef.current++;
    setStage("pick");
    setPlan(null);
    setError(null);
  }, []);

  const openDialog = useCallback(() => { reset(); setOpen(true); }, [reset]);
  const close = useCallback(() => { reset(); setOpen(false); }, [reset]);

  useEffect(() => {
    window.addEventListener(OPEN_EXTERNAL_IMPORT_EVENT, openDialog);
    return () => window.removeEventListener(OPEN_EXTERNAL_IMPORT_EVENT, openDialog);
  }, [openDialog]);

  const pickFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    // Kalendarz (.ics): od razu zapisuje przypomnienia jako notatki, bez etapu podglądu.
    if (files.every((f) => /\.ics$/i.test(f.name))) {
      try {
        await yjsStore.ready();
        const { importIcsFiles } = await import("@/lib/icsImport");
        const { created, skipped } = await importIcsFiles(files, yjsStore.projectNotes());
        toast.success(created ? `Dodano przypomnienia: ${created}` : "Brak nowych przypomnień", {
          description: skipped ? `Pominięto ${skipped} (bez czasu albo nieczytelne)` : undefined,
        });
        reset();
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nie udało się odczytać pliku .ics");
        setStage("pick");
      }
      return;
    }
    const run = ++runRef.current;
    setStage("reading");
    setError(null);
    try {
      await yjsStore.ready();
      const { analyzeFiles } = await import("@/lib/import");
      const next = await analyzeFiles(files, yjsStore.projectNotes());
      if (run !== runRef.current) return;
      setPlan(next);
      setStage("summary");
    } catch (err) {
      if (run !== runRef.current) return;
      setError(err instanceof Error ? err.message : "Nie udało się odczytać plików");
      setStage("pick");
    }
  }, []);

  const confirm = useCallback(async () => {
    if (!plan || !plan.notes.length) return;
    const run = ++runRef.current;
    setStage("saving");
    try {
      const { commitImportPlan, undoImport } = await import("@/lib/import");
      const result = await commitImportPlan(plan);
      if (run !== runRef.current) return;
      const n = result.noteIds.length;
      const label = pluralPl(n, ["notatka", "notatki", "notatek"]);
      toastWithUndo(`Zaimportowano ${n} ${label}`, () => undoImport(result), {
        description: result.failedImages ? `Nie udało się wczytać obrazów: ${result.failedImages}` : undefined,
        duration: 10000,
      });
      reset();
      setOpen(false);
    } catch (err) {
      if (run !== runRef.current) return;
      setError(err instanceof Error ? err.message : "Nie udało się zapisać notatek");
      setStage("summary");
    }
  }, [plan, reset]);

  // Plik otwarty z systemu (File Handling): od razu w imporcie. Bufor wypełniony przed montażem
  // (launchQueue działa wcześniej niż React) oddajemy tutaj, a późniejsze pliki przez zdarzenie.
  useEffect(() => {
    const drain = () => {
      const files = takeLaunchFiles();
      if (!files.length) return;
      openDialog();
      void pickFiles(files);
    };
    drain();
    window.addEventListener(LAUNCH_FILES_EVENT, drain);
    return () => window.removeEventListener(LAUNCH_FILES_EVENT, drain);
  }, [openDialog, pickFiles]);

  return { open, stage, plan, error, openDialog, close, pickFiles, confirm, backToPick: reset };
}
