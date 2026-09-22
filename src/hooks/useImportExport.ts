import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { Note, useNotes } from "@/hooks/useNotes";
import { importFromJSON } from "@/lib/exportNotes";

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
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(shareData)));
        addNote(decoded.t || "", decoded.c || "", decoded.co || "default", decoded.l || [], null, [], decoded.cl || []);
        toast.success("Zaimportowano udostępnioną notatkę!");
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        toast.error("Nieprawidłowy link udostępniania");
      }
    }
  }, [addNote]);

  return { handleImport };
}
