import { describe, expect, it } from "vitest";
import { createYjsStore } from "./yjsStore";

// F3 (plan Fable): podział `yjsStore.ts` na `src/lib/yjs/*` nie może zmienić publicznego kształtu magazynu.
// Każdy krok podziału zostawia tę listę bez zmian.
describe("yjsStore — kształt API (F3)", () => {
  it("lista kluczy i ich typy", () => {
    const store = createYjsStore(`shape-${Date.now()}`);
    const shape = Object.keys(store).sort().map((k) => `${k}:${typeof (store as Record<string, unknown>)[k]}`);
    expect(shape).toMatchInlineSnapshot(`
      [
        "addLabel:function",
        "beginTextEdit:function",
        "compactPersistence:function",
        "deletePropDef:function",
        "diagStats:function",
        "doc:object",
        "encodeStateVector:function",
        "encodeSyncState:function",
        "endTextEdit:function",
        "foldersMap:object",
        "getFutureContent:function",
        "getNoteText:function",
        "getRetiredEntries:function",
        "getVault:function",
        "getVaultMeta:function",
        "images:object",
        "importBatch:function",
        "insertNoteCopies:function",
        "isBulkWriting:function",
        "isLocked:function",
        "isPersistenceOrigin:function",
        "isTextEditOpen:function",
        "labelsMap:object",
        "lockNote:function",
        "lockedNoteIds:function",
        "mergeSyncState:function",
        "noteFileRefs:function",
        "notesMap:object",
        "observeVaultMeta:function",
        "onBulkWriteEnd:function",
        "onRemoteTextChange:function",
        "patchFolder:function",
        "patchNote:function",
        "patchNotes:function",
        "projectFolders:function",
        "projectLabels:function",
        "projectNotes:function",
        "projectPropDefs:function",
        "propDefsMap:object",
        "readPlainNote:function",
        "ready:function",
        "rebaseTextEdit:function",
        "referencedAttachments:function",
        "referencedImages:function",
        "rekeyVault:function",
        "remapImageRefs:function",
        "removeFolder:function",
        "removeLabelEverywhere:function",
        "removeNote:function",
        "removeNotes:function",
        "renameLabelEverywhere:function",
        "replaceAll:function",
        "replaceAllChunked:function",
        "resetForTests:function",
        "setLockedWriteSink:function",
        "setNoteOrder:function",
        "setVault:function",
        "setVaultMeta:function",
        "syncableRefs:function",
        "unlockNote:function",
        "upsertFolder:function",
        "upsertNote:function",
        "upsertPropDef:function",
      ]
    `);
  });
});
