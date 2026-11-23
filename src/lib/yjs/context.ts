import type * as Y from "yjs";
import type { Note } from "@/lib/types/note";
import type { ImageStore } from "@/lib/imageStore";
import type { YFolder, YNote, YPropDef } from "./codec";

/**
 * Wspólny stan magazynu (F3, krok 2): dokument, jego mapy i pamięć projekcji. Tworzy go `createYjsStore`,
 * a części wydzielone do `src/lib/yjs/*` dostają go jako argument fabryki — bez własnych kopii stanu.
 */
export interface StoreCtx {
  doc: Y.Doc;
  notesMap: Y.Map<YNote>;
  foldersMap: Y.Map<YFolder>;
  labelsMap: Y.Map<boolean>;
  propDefsMap: Y.Map<YPropDef>;
  vaultMap: Y.Map<unknown>;
  /** Notatki rzutowane od ostatniej zmiany — tożsamość obiektów dla `memo`. */
  noteCache: Map<string, Note>;
  /** Id notatek zmienionych od ostatniej projekcji (obserwator przy tworzeniu magazynu). */
  dirtyNotes: Set<string>;
  images: ImageStore;
}
