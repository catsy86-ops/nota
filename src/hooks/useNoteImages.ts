import { useRef } from "react";
import { toast } from "sonner";
import type { Note } from "@/hooks/useNotes";
import type { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";

/**
 * Obrazy notatki w kaflu: dodawanie z pliku, wklejanie do pola treści, rysunek i usuwanie.
 * Obraz trafia do `imageStore` (bajty), a notatka dostaje tylko referencję (klucz SHA-256).
 * Wyciągnięte z `NoteCard` bez zmiany zachowania; testy: `e2e/note-look.spec.ts`
 * i `e2e/editing.spec.ts` (edycja z obrazem), plus `e2e/paste-html.spec.ts` dla wklejania tekstu.
 */
export function useNoteImages({ note, onUpdate }: { note: Note } & Pick<ReturnType<typeof useNoteViewActions>, "onUpdate">) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    await addImages(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Wklejony zrzut ekranu albo skopiowany obraz trafia do notatki zamiast do pola tekstu. */
  function handleEditPaste(e: React.ClipboardEvent<Element>) {
    const pasted = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (pasted.length === 0) return;
    e.preventDefault();
    void addImages(pasted);
  }

  /** Obrazy większe niż limit są skalowane; dopiero gdy się nie da, trafiają na listę pominiętych. */
  async function addImages(files: File[]) {
    const newImages: string[] = [];
    let skipped = 0;
    try {
      for (const file of files) {
        const prepared = await prepareImage(file);
        if (!prepared) { skipped++; continue; }
        newImages.push(await imageStore.putBlob(prepared));
      }
    } catch {
      toast.error("Nie udało się zapisać obrazka", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare notatki z obrazkami i spróbuj ponownie." });
    }
    if (skipped > 0) {
      toast.error(skipped === 1 ? "Obrazek jest za duży (max 2 MB)" : `${skipped} obrazków jest za dużych (max 2 MB)`, {
        description: newImages.length > 0 ? "Pozostałe zostały dodane." : undefined,
      });
    }
    if (newImages.length) onUpdate?.(note.id, { images: [...(note.images || []), ...newImages] });
  }

  /** Rysunek z płótna (data URL) zapisywany jak zwykły obraz. */
  function addDrawing(dataUrl: string) {
    imageStore.putDataUrl(dataUrl)
      .then((ref) => onUpdate?.(note.id, { images: [...(note.images || []), ref] }))
      .catch(() => toast.error("Nie udało się zapisać rysunku", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare obrazy albo zrób kopię zapasową i spróbuj ponownie." }));
  }

  /** Usunięcie z „Cofnij” — poprzednia lista obrazów wraca bez zmian. */
  function removeImage(idx: number) {
    const before = [...(note.images || [])];
    const updated = [...before];
    updated.splice(idx, 1);
    onUpdate?.(note.id, { images: updated });
    toast("Usunięto obrazek", { action: { label: "Cofnij", onClick: () => onUpdate?.(note.id, { images: before }) } });
  }

  return { fileInputRef, handleImageUpload, handleEditPaste, addDrawing, removeImage };
}
