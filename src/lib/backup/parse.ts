import { SCHEMA_VERSION } from "@/lib/formatSchema";
// Schematy (zod) ładują się dopiero przy imporcie/backupie — nie ma ich w startowym bundlu.
import type { FullBackup } from "@/lib/noteSchema";
import { APP_NAME } from "@/lib/appName";

export const loadSchemas = () => import("@/lib/noteSchema");

// Załączniki (do 40 MB surowych, ~53 MB jako base64) mieszczą się obok notatek i obrazów.
export const MAX_IMPORT_FILE_SIZE = 120 * 1024 * 1024; // 120 MB

/** Kopia większa niż limit wczytywania nie da się przywrócić — trzeba ostrzec przy zapisie, nie przy awarii (W13). */
export const isBackupOversize = (bytes: number): boolean => bytes > MAX_IMPORT_FILE_SIZE;
export const BACKUP_OVERSIZE_NOTE = `Kopia jest większa niż ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)} MB, więc aplikacja nie da rady jej wczytać. Zmniejsz załączniki albo zdjęcia (Praca → zmniejsz zdjęcia) i zrób kopię jeszcze raz.`;

/** Najwyższa wersja kopii, którą ta aplikacja umie wczytać; nowsza ma sekcje, które po cichu by zgubiła. */
export const MAX_BACKUP_VERSION = 3;

export async function parseFullBackup(text: string): Promise<FullBackup> {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as Record<string, unknown>).notes)) {
    throw new Error(`To nie jest plik pełnego backupu aplikacji ${APP_NAME}`);
  }
  const version = (raw as Record<string, unknown>).version;
  const schema = (raw as Record<string, unknown>).schema;
  // D5.3: nowsza koperta albo nowszy format dokumentu — odmowa bez częściowego importu.
  if ((typeof version === "number" && version > MAX_BACKUP_VERSION) || (typeof schema === "number" && schema > SCHEMA_VERSION)) {
    throw new Error("Ta kopia pochodzi z nowszej wersji aplikacji. Zaktualizuj aplikację i spróbuj ponownie.");
  }
  const { fullBackupSchema } = await loadSchemas();
  return fullBackupSchema.parse(raw);
}
