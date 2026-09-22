import { createContext, useContext, type ReactNode } from "react";
import { useNotes } from "@/hooks/useNotes";

type NotesContextValue = ReturnType<typeof useNotes>;

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const value = useNotes();
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

/** Access the notes domain (notes/folders/labels + mutators) without prop-drilling. */
export function useNotesContext(): NotesContextValue {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotesContext must be used within a NotesProvider");
  return ctx;
}
