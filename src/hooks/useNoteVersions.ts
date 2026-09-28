import { useCallback, useEffect, useSyncExternalStore } from "react";
import { versionsStore, type NoteVersion } from "@/lib/versionsStore";

export type { NoteVersion };

/** Historia wersji notatek — dane w `lib/versionsStore.ts` (IndexedDB, klucz na notatkę). */
export function useNoteVersions() {
  const tick = useSyncExternalStore(versionsStore.subscribe, versionsStore.getTick);
  useEffect(() => { void versionsStore.load(); }, []);

  const addVersion = useCallback((noteId: string, title: string, content: string) => {
    versionsStore.add(noteId, title, content);
  }, []);

  // `tick` w zależnościach: nowa tożsamość funkcji po zmianie historii,
  // żeby karty z otwartym menu wersji się odświeżyły.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getVersions = useCallback((noteId: string) => versionsStore.get(noteId), [tick]);

  const deleteVersions = useCallback((noteIds: string | string[]) => {
    versionsStore.remove(noteIds);
  }, []);

  return { addVersion, getVersions, deleteVersions };
}
