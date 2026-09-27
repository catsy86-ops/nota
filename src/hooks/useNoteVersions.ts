import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  content: string;
  timestamp: number;
}

const VERSIONS_KEY = "kaczy-notes-versions";
const MAX_VERSIONS_PER_NOTE = 20;

function loadVersions(): NoteVersion[] {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Zapis nie może rzucić: wołany z `useEffect`, więc `QuotaExceededError`
 * poleciałby prosto do `ErrorBoundary` i położył całą aplikację. Przy braku
 * miejsca zrzucamy najstarsze wersje, aż się zmieści; notatki (Yjs/IndexedDB)
 * są od tego niezależne.
 */
export function saveVersions(versions: NoteVersion[], storage: Storage = localStorage): boolean {
  let kept = versions;
  while (true) {
    try {
      storage.setItem(VERSIONS_KEY, JSON.stringify(kept));
      return kept.length === versions.length;
    } catch {
      if (kept.length === 0) return false;
      kept = [...kept].sort((a, b) => b.timestamp - a.timestamp).slice(0, Math.floor(kept.length / 2));
    }
  }
}

export function useNoteVersions() {
  const [versions, setVersions] = useState<NoteVersion[]>(loadVersions);

  useEffect(() => {
    if (!saveVersions(versions)) {
      toast.warning("Brak miejsca na historię wersji", {
        description: "Najstarsze wersje nie zostały zapisane. Notatki są bezpieczne.",
        id: "versions-quota",
      });
    }
  }, [versions]);

  const addVersion = useCallback((noteId: string, title: string, content: string) => {
    setVersions((prev) => {
      const noteVersions = prev.filter((v) => v.noteId === noteId);
      // Don't save if content hasn't changed
      if (noteVersions.length > 0) {
        const latest = noteVersions[0];
        if (latest.title === title && latest.content === content) return prev;
      }
      const version: NoteVersion = {
        id: crypto.randomUUID(),
        noteId,
        title,
        content,
        timestamp: Date.now(),
      };
      const otherVersions = prev.filter((v) => v.noteId !== noteId);
      const kept = [version, ...noteVersions].slice(0, MAX_VERSIONS_PER_NOTE);
      return [...kept, ...otherVersions];
    });
  }, []);

  const getVersions = useCallback((noteId: string) => {
    return versions
      .filter((v) => v.noteId === noteId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [versions]);

  const deleteVersions = useCallback((noteIds: string | string[]) => {
    const ids = new Set(Array.isArray(noteIds) ? noteIds : [noteIds]);
    setVersions((prev) => (prev.some((v) => ids.has(v.noteId)) ? prev.filter((v) => !ids.has(v.noteId)) : prev));
  }, []);

  return { addVersion, getVersions, deleteVersions };
}
