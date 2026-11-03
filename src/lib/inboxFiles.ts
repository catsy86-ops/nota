import { toast } from "sonner";
import { describeRejections } from "@/lib/attachments";
import { importSharedFiles, type ImportedFiles } from "@/lib/shareInbox";
import { yjsStore } from "@/lib/yjsStore";

/**
 * Pliki do nowej notatki (udostępnienie z systemu, Skrzynka 2.5: wklejenie albo upuszczenie):
 * obrazy jako zdjęcia, PDF jako załącznik — limit łączny liczony z załączników już w aplikacji.
 */
export function importNoteFiles(files: File[]): Promise<ImportedFiles> {
  const used = new Map<string, number>();
  yjsStore.referencedAttachments().forEach((a, hash) => used.set(hash, a.size));
  return importSharedFiles(files, used);
}

/** Komunikaty o plikach, których nie przyjęto (zły typ, za duży obraz, limit załączników). */
export function warnImportedFiles(imported: ImportedFiles): void {
  if (imported.unsupported.length) {
    toast.error(`Nie przyjęto: ${imported.unsupported.join(", ")}`, { description: "Z plików przyjmuję obrazy i PDF.", duration: 9000 });
  }
  if (imported.skippedImages > 0) {
    toast.error(imported.skippedImages === 1 ? "Nie udało się zmniejszyć obrazka do 2 MB" : `${imported.skippedImages} obrazków nie udało się zmniejszyć do 2 MB`);
  }
  const problem = describeRejections(imported.rejected);
  if (problem) toast.error("Część plików nie została dodana", { description: problem, duration: 9000 });
}
