import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useNotes } from "@/hooks/useNotes";
import { yjsStore } from "@/lib/yjsStore";
import { initSync } from "@/lib/yjsSync";

type NotesContextValue = ReturnType<typeof useNotes>;

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const value = useNotes();

  // Resume a previously-paired P2P sync only after the Yjs doc is fully
  // hydrated/migrated (see yjsStore.ts) — connecting before that could race
  // an incoming remote update against the one-time legacy-store migration.
  useEffect(() => {
    yjsStore.ready().then(initSync);
  }, []);

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

/** Access the notes domain (notes/folders/labels + mutators) without prop-drilling. */
export function useNotesContext(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotesContext must be used within a NotesProvider");
  return ctx;
}
