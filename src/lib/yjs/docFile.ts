import * as Y from "yjs";
import type { Note, Folder } from "@/lib/types/note";
import { cleanPropDefs, type PropDef } from "@/lib/noteProps";
import { type YNote, type YFolder, type YPropDef, plainPropDefFromY, plainFromYNote, plainFromYFolder } from "./codec";

/**
 * Dokument poza działającym magazynem (F3): odczyt kopii do osobnego `Y.Doc` i awaryjna wymiana zapisanej bazy
 * przed otwarciem (Z-16.1B). Bez stanu magazynu.
 */

/** Stan dokumentu odczytany z kopii (Z-16.1B): tylko do porównania i kopiowania, nic nie jest scalane. */
export interface DocState {
  notes: Note[];
  folders: Folder[];
  propDefs: PropDef[];
  vaultMeta: unknown;
}

/**
 * Odczyt pełnego stanu (update V2, np. kopia dzienna) do **osobnego** `Y.Doc` w pamięci — niepodłączonego do bazy,
 * synchronizacji ani kart. Wczytanie starej migawki do działającego dokumentu niczego by nie cofnęło (Yjs scala,
 * nowszy stan wygrywa), dlatego przywracanie czyta ją obok. Uszkodzona aktualizacja rzuca.
 */
export function readDocState(update: Uint8Array): DocState {
  const doc = new Y.Doc();
  try {
    Y.applyUpdateV2(doc, update);
    const notes: Note[] = [];
    doc.getMap<YNote>("notes").forEach((y, id) => notes.push(plainFromYNote(id, y)));
    const folders: Folder[] = [];
    doc.getMap<YFolder>("folders").forEach((y, id) => folders.push(plainFromYFolder(id, y)));
    const defs: PropDef[] = [];
    doc.getMap<YPropDef>("propDefs").forEach((y, id) => {
      const def = plainPropDefFromY(id, y);
      if (def) defs.push(def);
    });
    return { notes, folders, propDefs: cleanPropDefs(defs), vaultMeta: doc.getMap<unknown>("vault").get("meta") };
  } finally {
    doc.destroy();
  }
}

/** Czas na zamknięcie połączeń innych kart przy podniesieniu wersji bazy. */
const BLOCKED_TIMEOUT_MS = 10_000;

/**
 * Otwarcie bazy dokumentu bez y-indexeddb w **nowej wersji**: zmiana wersji wysyła \`versionchange\` do wszystkich
 * otwartych połączeń, a \`lib0/indexeddb\` je wtedy zamyka. Karta ze starym dokumentem (zamrożona, starsza wersja
 * aplikacji) traci więc połączenie, zanim baza zostanie wyczyszczona, i nie dopisze starego stanu po wymianie.
 * Brakujące magazyny (\`updates\` z autonumerem, \`custom\`) są zakładane przy tej samej zmianie wersji.
 */
async function openDocDbExclusive(dbName: string): Promise<IDBDatabase> {
  const current = await new Promise<number>((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => { const v = req.result.version; req.result.close(); resolve(v); };
    req.onerror = () => reject(req.error);
  });
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, current + 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("updates")) db.createObjectStore("updates", { autoIncrement: true });
      if (!db.objectStoreNames.contains("custom")) db.createObjectStore("custom");
    };
    req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
    req.onerror = () => { clearTimeout(timer); reject(req.error); };
    // Zablokowane = inna karta jeszcze nie zamknęła połączenia; czekamy, ale nie bez końca.
    req.onblocked = () => {
      timer ??= setTimeout(() => reject(new Error("inna karta trzyma bazę — zamknij pozostałe karty aplikacji")), BLOCKED_TIMEOUT_MS);
    };
  });
}

/**
 * Wymiana zapisanego dokumentu (Z-16.1B, ścieżka awaryjna): **jedna transakcja** — wyczyszczenie aktualizacji
 * i zapis pełnego stanu z kopii (albo nic — pusty dokument). Przerwanie zostawia stary albo nowy stan, nigdy pustą
 * bazę w połowie. Wołać tylko przed otwarciem \`IndexeddbPersistence\` (hak \`beforeOpen\`). Uszkodzona kopia rzuca
 * przed dotknięciem bazy; błąd otwarcia rzuca (bez usuwania bazy — to zrobi najwyżej użytkownik).
 */
export async function replacePersistedDoc(dbName: string, updateV2: Uint8Array | null): Promise<void> {
  let v1: Uint8Array | null = null;
  if (updateV2) {
    const check = new Y.Doc();
    try {
      Y.applyUpdateV2(check, updateV2);
      v1 = Y.encodeStateAsUpdate(check);
    } finally {
      check.destroy();
    }
  }
  const db = await openDocDbExclusive(dbName);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["updates", "custom"], "readwrite");
      tx.objectStore("updates").clear();
      tx.objectStore("custom").clear();
      if (v1) tx.objectStore("updates").add(v1);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("transakcja przerwana"));
    });
  } finally {
    db.close();
  }
}
