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

  /** Wklejony zrzut ekranu albo skopiowany obraz trafia do notatki zamiast do pola tekstu; wklejony PDF — do załączników. */
  function handleEditPaste(e: React.ClipboardEvent<Element>) {
    const files = Array.from(e.clipboardData.files);
    if (files.some((f) => f.type === "application/pdf")) {
      e.preventDefault();
      void addFiles(files);
      return;
    }
    const pasted = files.filter((f) => f.type.startsWith("image/"));
    if (pasted.length === 0) return;
    e.preventDefault();
    void addImages(pasted);
  }

  /**
   * Plan Notatek 2.6: pliki przeciągnięte na otwarty edytor — obrazy do zdjęć notatki, PDF do załączników. Łapane
   * w fazie przechwytywania, zanim CodeMirror wstawi zawartość pliku jako tekst. Przeciągany tekst idzie dalej bez zmian.
   */
  function handleEditDragOver(e: React.DragEvent<Element>) {
    if (Array.from(e.dataTransfer.types).includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }
  }
  function handleEditDrop(e: React.DragEvent<Element>) {
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    void addFiles(files);
  }

  /** Obrazy i PDF tą samą drogą co udostępnianie i Skrzynka (limity, zmniejszanie, komunikaty o odrzuconych). */
  async function addFiles(files: File[]) {
    try {
      const { importNoteFiles, warnImportedFiles } = await import("@/lib/inboxFiles");
      const imported = await importNoteFiles(files);
      warnImportedFiles(imported);
      const patch: Partial<Note> = {};
      if (imported.images.length) patch.images = [...(note.images || []), ...imported.images];
      if (imported.attachments.length) patch.attachments = [...(note.attachments ?? []), ...imported.attachments];
      if (patch.images || patch.attachments) {
        onUpdate?.(note.id, patch);
        const n = imported.images.length + imported.attachments.length;
        toast.success(n === 1 ? "Dodano plik do notatki" : `Dodano pliki do notatki: ${n}`);
      }
    } catch {
      toast.error("Nie udało się dodać plików", { description: "Sprawdź połączenie i spróbuj jeszcze raz." });
    }
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

  return { fileInputRef, handleImageUpload, handleEditPaste, handleEditDragOver, handleEditDrop, addDrawing, removeImage };
}
