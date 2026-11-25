/**
 * Reeksport kopii zapasowej (A3.1): kod jest w `src/lib/backup/` — `sections`, `build`, `parse`, `merge`, `download`.
 * Plik zostaje do czasu zamiany importów w reszcie kodu.
 */
export { MERGE_SECTIONS, SHIFTS_SECTION, STUDY_SECTION } from "@/lib/backup/sections";
export {
  withEmbeddedImages, withStoredImages, embeddableImages, describeSkippedAttachments, buildFullBackupWithReport, buildFullBackup,
  SETTING_VALUE_MAX, SETTINGS_KEYS, ACHIEVEMENTS_KEY, type BackupAttachmentReport,
} from "@/lib/backup/build";
export { isBackupOversize, BACKUP_OVERSIZE_NOTE, MAX_BACKUP_VERSION, parseFullBackup } from "@/lib/backup/parse";
export { RestoreCheckError, restoreScope, restoreFullBackup, type RestoreOptions, type RestoreRun } from "@/lib/backup/merge";
export { download, exportToJSON, exportFullBackup, pickFullBackup, shareFullBackup, exportToMarkdown, exportToHTML, importFromJSON } from "@/lib/backup/download";
export { RESTORE_MARKER_KEY, readRestoreMarker, clearRestoreMarker, type RestoreMarker } from "@/lib/restoreMarker";
