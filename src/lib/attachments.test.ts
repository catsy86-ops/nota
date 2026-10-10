import { describe, it, expect, beforeEach } from "vitest";
import {
  addAttachmentFiles, attachmentKind, describeRejections, downloadAttachment, formatFileSize, isAttachmentSyncable,
  isTextPreviewable, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_NOTE, MAX_ATTACHMENTS_TOTAL_BYTES, normalizeAttachments,
  resolveMimeType, safeDownloadType, sanitizeFileName, textPreview, ATTACHMENT_SYNC_MAX_BYTES, type Attachment,
} from "./attachments";
import { createImageStore, GC_GRACE_MS } from "./imageStore";
import { createYjsStore } from "./yjsStore";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "T", content: "", color: "default", pinned: false, archived: false, trashed: false,
    trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
    order: 0, createdAt: 0, updatedAt: 0, ...overrides,
  };
}

const file = (name: string, text: string, type = "text/plain") => new File([text], name, { type });

describe("formatFileSize", () => {
  it("uses a decimal comma and binary units", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(900)).toBe("900 B");
    expect(formatFileSize(1536)).toBe("1,5 KB");
    expect(formatFileSize(1.2 * 1024 * 1024)).toBe("1,2 MB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
  });
});

describe("sanitizeFileName", () => {
  it("strips paths, control and reserved characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\x\\raport.pdf")).toBe("raport.pdf");
    expect(sanitizeFileName("a\u0000b\u202ec.txt")).toBe("abc.txt");
    expect(sanitizeFileName('co:"to"?.md')).toBe("co_to_.md");
  });
  it("handles hidden, empty and reserved names", () => {
    expect(sanitizeFileName("...")).toBe("plik");
    expect(sanitizeFileName(".htaccess")).toBe("htaccess");
    expect(sanitizeFileName("CON.txt")).toBe("_CON.txt");
    expect(sanitizeFileName("  ")).toBe("plik");
  });
  it("shortens long names but keeps the extension", () => {
    const name = sanitizeFileName(`${"a".repeat(300)}.pdf`);
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});

describe("typy MIME", () => {
  it("falls back to the extension and to octet-stream", () => {
    expect(resolveMimeType("x.pdf", "")).toBe("application/pdf");
    expect(resolveMimeType("x.bin", "")).toBe("application/octet-stream");
    expect(resolveMimeType("x.pdf", "Text/Plain; charset=utf-8")).toBe("text/plain");
  });
  it("never lets active content keep its type on download", () => {
    expect(safeDownloadType("text/html")).toBe("application/octet-stream");
    expect(safeDownloadType("image/svg+xml")).toBe("application/octet-stream");
    expect(safeDownloadType("application/xhtml+xml")).toBe("application/octet-stream");
    expect(safeDownloadType("application/pdf")).toBe("application/pdf");
  });
  it("classifies and previews only plain text", () => {
    expect(attachmentKind({ name: "a.pdf", type: "" })).toBe("pdf");
    expect(attachmentKind({ name: "a.docx", type: "" })).toBe("doc");
    expect(attachmentKind({ name: "a.zip", type: "" })).toBe("archive");
    expect(isTextPreviewable({ name: "a.md", type: "" })).toBe(true);
    expect(isTextPreviewable({ name: "a.html", type: "text/html" })).toBe(false);
    expect(isTextPreviewable({ name: "a.svg", type: "image/svg+xml" })).toBe(false);
  });
  it("takes the first lines of a preview", () => {
    const r = textPreview(Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n"));
    expect(r.text.split("\n")).toHaveLength(20);
    expect(r.truncated).toBe(true);
  });
});

describe("normalizeAttachments", () => {
  it("keeps valid entries, merges duplicate hashes, drops junk", () => {
    const h = "a".repeat(64);
    expect(normalizeAttachments([{ hash: h, name: "x.txt", size: 3, type: "text/plain" }, { hash: h, name: "y", size: 1, type: "" }, null, { hash: "zly" }]))
      .toEqual([{ hash: h, name: "x.txt", size: 3, type: "text/plain" }]);
    expect(normalizeAttachments("nope")).toEqual([]);
    expect(normalizeAttachments(undefined)).toEqual([]);
  });
});

describe("addAttachmentFiles", () => {
  let store: ReturnType<typeof createImageStore>;
  beforeEach(() => { store = createImageStore(`att-${crypto.randomUUID()}`); });

  it("stores content once and deduplicates by hash", async () => {
    const r1 = await addAttachmentFiles([file("a.txt", "to samo"), file("b.txt", "to samo")], { current: [], used: new Map(), store });
    expect(r1.added).toHaveLength(1);
    expect(r1.added[0]).toMatchObject({ name: "a.txt", size: 7, type: "text/plain" });
    expect(r1.rejected).toEqual([{ name: "b.txt", reason: "duplicate" }]);
    expect(store.has(r1.added[0].hash)).toBe(true);
  });

  it("rejects files above the per-file limit and empty files", async () => {
    const big = new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], "duzy.pdf", { type: "application/pdf" });
    const r = await addAttachmentFiles([big, file("pusty.txt", "")], { current: [], used: new Map(), store });
    expect(r.added).toEqual([]);
    expect(r.rejected.map((x) => x.reason)).toEqual(["too-big", "empty"]);
    expect(describeRejections(r.rejected)).toContain("Za duże");
  });

  it("enforces the total limit over unique content but lets known blobs through", async () => {
    const known = new Map([["f".repeat(64), MAX_ATTACHMENTS_TOTAL_BYTES - 3]]);
    const r = await addAttachmentFiles([file("duzo.txt", "12345")], { current: [], used: known, store });
    expect(r.rejected).toEqual([{ name: "duzo.txt", reason: "total-limit" }]);
    expect(describeRejections(r.rejected)).toContain("łączny limit");
    // ten sam hash już policzony — nie dokłada do sumy
    const first = await addAttachmentFiles([file("a.txt", "12345")], { current: [], used: new Map(), store });
    const used = new Map([[first.added[0].hash, MAX_ATTACHMENTS_TOTAL_BYTES]]);
    const again = await addAttachmentFiles([file("kopia.txt", "12345")], { current: [], used, store });
    expect(again.added).toHaveLength(1);
  });

  it("caps the number of attachments per note", async () => {
    const current: Attachment[] = Array.from({ length: MAX_ATTACHMENTS_PER_NOTE }, (_, i) => ({ hash: i.toString(16).padStart(64, "0"), name: `f${i}`, size: 1, type: "" }));
    const r = await addAttachmentFiles([file("jeszcze.txt", "x")], { current, used: new Map(), store });
    expect(r.rejected[0].reason).toBe("too-many");
  });

  it("reports a quota error without adding the file to the manifest", async () => {
    const failing = Object.assign(Object.create(store), {
      putBytes: async () => { throw Object.assign(new Error("full"), { name: "QuotaExceededError" }); },
    }) as typeof store;
    const r = await addAttachmentFiles([file("a.txt", "abc")], { current: [], used: new Map(), store: failing });
    expect(r.added).toEqual([]);
    expect(r.rejected).toEqual([{ name: "a.txt", reason: "quota" }]);
    expect(describeRejections(r.rejected)).toContain("Brakuje miejsca");
  });

  it("downloads with a sanitized name and a safe MIME, never navigating", async () => {
    const [att] = (await addAttachmentFiles([file("x.html", "<script>alert(1)</script>", "text/html")], { current: [], used: new Map(), store })).added;
    expect(att.type).toBe("text/html");
    const blobs: Blob[] = [];
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = ((b: Blob) => { blobs.push(b); return "blob:test"; }) as typeof URL.createObjectURL;
    let seen: { download: string; target: string } | null = null;
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { seen = { download: this.download, target: this.target }; };
    try {
      expect(await downloadAttachment({ ...att, name: "../x.html" }, store)).toBe(true);
      expect(await downloadAttachment({ ...att, hash: "0".repeat(64) }, store)).toBe(false);
    } finally {
      URL.createObjectURL = origCreate;
      HTMLAnchorElement.prototype.click = origClick;
    }
    expect(blobs[0].type).toBe("application/octet-stream");
    expect(seen).toEqual({ download: "x.html", target: "" });
  });

  it("flags files above the sync cap as device-local", () => {
    expect(isAttachmentSyncable({ size: ATTACHMENT_SYNC_MAX_BYTES })).toBe(true);
    expect(isAttachmentSyncable({ size: ATTACHMENT_SYNC_MAX_BYTES + 1 })).toBe(false);
  });
});

describe("yjsStore — załączniki", () => {
  const fresh = () => {
    const images = createImageStore(`yjs-att-${crypto.randomUUID()}`);
    return { images, store: createYjsStore(`att-doc-${crypto.randomUUID()}`, images) };
  };
  const att = (c: string, size = 10): Attachment => ({ hash: c.repeat(64), name: `${c}.pdf`, size, type: "application/pdf" });

  it("round-trips the manifest and leaves notes without it untouched", () => {
    const { store } = fresh();
    store.upsertNote(makeNote({ id: "a", attachments: [att("a")] }));
    store.upsertNote(makeNote({ id: "b" }));
    expect(store.projectNotes().find((n) => n.id === "a")!.attachments).toEqual([att("a")]);
    expect(store.projectNotes().find((n) => n.id === "b")!.attachments).toBeUndefined();
    expect(store.notesMap.get("b")!.has("attachments")).toBe(false);
    store.patchNote("a", { attachments: [] });
    expect(store.projectNotes().find((n) => n.id === "a")!.attachments).toBeUndefined();
  });

  it("syncs the manifest between peers and ignores garbage from a peer", () => {
    const a = fresh().store;
    const b = fresh().store;
    a.upsertNote(makeNote({ id: "n", attachments: [att("a")] }));
    b.mergeSyncState(a.encodeSyncState());
    expect(b.projectNotes()[0].attachments).toEqual([att("a")]);
    b.notesMap.get("n")!.set("attachments", [{ hash: "../x" }, 5]);
    expect(b.projectNotes()[0].attachments).toBeUndefined();
  });

  it("GC keeps a blob while any note still uses it, and collects it afterwards", async () => {
    const { store, images } = fresh();
    const bytes = new TextEncoder().encode("wspólny plik");
    const hash = await images.putBytes(bytes, "text/plain");
    const a: Attachment = { hash, name: "a.txt", size: bytes.length, type: "text/plain" };
    store.upsertNote(makeNote({ id: "n1", attachments: [a] }));
    store.upsertNote(makeNote({ id: "n2", attachments: [{ ...a, name: "inna-nazwa.txt" }] }));
    const old = Date.now() + GC_GRACE_MS + 1000;

    store.removeNotes(["n1"]);
    expect(store.referencedImages().has(hash)).toBe(true);
    expect(await images.collectGarbage(store.referencedImages(), old)).toBe(0);
    expect(images.has(hash)).toBe(true);

    store.patchNote("n2", { attachments: [] });
    expect(await images.collectGarbage(store.referencedImages(), old)).toBe(1);
    expect(images.has(hash)).toBe(false);
  });

  it("only attachments within the sync cap are offered to peers", () => {
    const { store } = fresh();
    store.upsertNote(makeNote({ id: "n", images: ["1".repeat(64)], attachments: [att("a", 100), att("b", ATTACHMENT_SYNC_MAX_BYTES + 1)] }));
    const refs = store.syncableRefs();
    expect(refs.has("a".repeat(64))).toBe(true);
    expect(refs.has("b".repeat(64))).toBe(false);
    expect(refs.has("1".repeat(64))).toBe(true);
    expect(store.referencedImages().has("b".repeat(64))).toBe(true);
  });
});
