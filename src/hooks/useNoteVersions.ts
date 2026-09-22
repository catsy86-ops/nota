import { useState, useCallback, useEffect } from "react";

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

function saveVersions(versions: NoteVersion[]) {
  localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
}

export function useNoteVersions() {
  const [versions, setVersions] = useState<NoteVersion[]>(loadVersions);

  useEffect(() => { saveVersions(versions); }, [versions]);

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

  const deleteVersions = useCallback((noteId: string) => {
    setVersions((prev) => prev.filter((v) => v.noteId !== noteId));
  }, []);

  return { addVersion, getVersions, deleteVersions };
}
