import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useNotes } from "@/hooks/useNotes";
import { yjsStore } from "@/lib/yjsStore";
import { initSync } from "@/lib/yjsSync";

type NotesContextValue = ReturnType<typeof useNotes>;

const NotesContext = createContext<NotesContextValue | null>(null);

/** Foldery i etykiety bez listy notatek — dla kart, żeby edycja jednej notatki nie przerysowywała wszystkich. */
type NotesMetaValue = Pick<NotesContextValue, "folders" | "allLabels" | "addLabel">;
const NotesMetaContext = createContext<NotesMetaValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const value = useNotes();

  // Resume a previously-paired P2P sync only after the Yjs doc is fully
  // hydrated/migrated (see yjsStore.ts) — connecting before that could race
  // an incoming remote update against the one-time legacy-store migration.
  useEffect(() => {
    yjsStore.ready().then(initSync);
  }, []);

  const { folders, allLabels, addLabel } = value;
  const meta = useMemo(() => ({ folders, allLabels, addLabel }), [folders, allLabels, addLabel]);

  return (
    <NotesContext.Provider value={value}>
      <NotesMetaContext.Provider value={meta}>{children}</NotesMetaContext.Provider>
    </NotesContext.Provider>
  );
}

/** Access the notes domain (notes/folders/labels + mutators) without prop-drilling. */
export function useNotesContext(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotesContext must be used within a NotesProvider");
  return ctx;
}

export function useNotesMeta(): NotesMetaValue {
  const ctx = useContext(NotesMetaContext);
  if (!ctx) throw new Error("useNotesMeta must be used within a NotesProvider");
  return ctx;
}
