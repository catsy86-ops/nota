import { describe, it, expect, beforeEach, vi } from "vitest";
import { exportToJSON, exportToMarkdown, exportToHTML } from "./exportNotes";
import { noteSchema, looksLikeNoteArray } from "./noteSchema";
import { imageStore } from "./imageStore";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1",
    title: "Zakupy",
    content: "Mleko, chleb",
    color: "default",
    pinned: false,
    archived: false,
    trashed: false,
    trashedAt: null,
    labels: [],
    reminder: null,
    priority: "none",
    images: [],
    checklist: [],
    folderId: null,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

// exportNotes' `download()` helper drives the browser's save-file dance
// (Blob URL + a synthetic <a click>) — none of it exists in jsdom by default.
let capturedContent = "";
let capturedType = "";
let capturedFilename = "";

beforeEach(() => {
  capturedContent = "";
  capturedType = "";
  capturedFilename = "";

  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => {
      capturedType = blob.type;
      return "blob:mock";
    }),
    revokeObjectURL: vi.fn(),
  });

  // Z prototypu, nie z `document.createElement`: po poprzednim teście to już szpieg, a bind na nim zapętla się rekurencyjnie (Vitest 4).
  const realCreateElement = Document.prototype.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = realCreateElement(tag);
    if (tag === "a") {
      el.click = vi.fn(() => { capturedFilename = (el as HTMLAnchorElement).download; });
    }
    return el;
  });

  // Blob content isn't captured by createObjectURL itself; read it via a
  // Blob subclass shim that stashes the text synchronously on construction.
  const RealBlob = Blob;
  vi.stubGlobal("Blob", class extends RealBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      capturedContent = parts.map((p) => (typeof p === "string" ? p : "")).join("");
    }
  });
});

const IMG = "data:image/png;base64,AAAA";

describe("exportToJSON", () => {
  it("serializes the full note list with images embedded as data URLs, and returns filename/size", async () => {
    const ref = await imageStore.putDataUrl(IMG);
    const missing = "f".repeat(64);
    const note = makeNote({ images: [ref, missing] });
    const { filename, size } = await exportToJSON([note]);

    expect(filename).toMatch(/^notki-kopia-.*\.json$/);
    expect(size).toBeGreaterThan(0);
    expect(capturedType).toBe("application/json");

    const parsed = JSON.parse(capturedContent);
    // Obraz, którego nie ma na urządzeniu, zostaje kluczem — referencja nie ginie.
    expect(parsed).toEqual([{ ...note, images: [IMG, missing] }]);
  });

  it("uses a custom filename when provided", async () => {
    const { filename } = await exportToJSON([makeNote()], "custom.json");
    expect(filename).toBe("custom.json");
  });
});

describe("exportToMarkdown", () => {
  it("includes title, labels, reminder and checklist", async () => {
    const note = makeNote({
      labels: ["dom"],
      reminder: new Date(2026, 0, 1, 9, 0).getTime(),
      checklist: [{ id: "c1", text: "Mleko", checked: true }, { id: "c2", text: "Chleb", checked: false }],
    });
    await exportToMarkdown([note]);

    expect(capturedFilename).toBe("notki-eksport.md");
    expect(capturedContent).toContain("## Zakupy");
    expect(capturedContent).toContain("*Etykiety: dom*");
    expect(capturedContent).toContain("Mleko, chleb");
    expect(capturedContent).toContain("- [x] Mleko");
    expect(capturedContent).toContain("- [ ] Chleb");
  });

  it("embeds stored images as markdown image links and skips missing ones", async () => {
    const note = makeNote({ images: [await imageStore.putDataUrl(IMG), "f".repeat(64)] });
    await exportToMarkdown([note]);
    expect(capturedContent).toContain(`![obraz 1](${IMG})`);
    expect(capturedContent).not.toContain("obraz 2");
  });
});

describe("exportToHTML", () => {
  it("escapes title/content to prevent HTML/script injection", async () => {
    const note = makeNote({ title: "<script>alert(1)</script>", content: "a & b < c" });
    await exportToHTML([note]);

    expect(capturedContent).not.toContain("<script>alert(1)</script>");
    expect(capturedContent).toContain("&lt;script&gt;");
    expect(capturedContent).toContain("a &amp; b &lt; c");
  });

  it("renders stored images as <img> tags", async () => {
    const note = makeNote({ images: [await imageStore.putDataUrl(IMG)] });
    await exportToHTML([note]);
    expect(capturedContent).toContain(`<img src="${IMG}"`);
  });
});

describe("noteSchema", () => {
  it("accepts a well-formed note unchanged", () => {
    const note = makeNote({ labels: ["dom"] });
    expect(noteSchema.parse(note)).toEqual(note);
  });

  it("fills in fallbacks for missing/malformed fields", () => {
    const parsed = noteSchema.parse({ id: "x", title: "T", color: "not-a-real-color" });
    expect(parsed.id).toBe("x");
    expect(parsed.title).toBe("T");
    expect(parsed.content).toBe("");
    expect(parsed.color).toBe("default");
    expect(parsed.labels).toEqual([]);
    expect(parsed.checklist).toEqual([]);
    expect(typeof parsed.createdAt).toBe("number");
  });

  it("generates an id when missing", () => {
    const parsed = noteSchema.parse({ title: "No id" });
    expect(typeof parsed.id).toBe("string");
    expect(parsed.id.length).toBeGreaterThan(0);
  });
});

describe("looksLikeNoteArray", () => {
  it("accepts an array of objects", () => {
    expect(looksLikeNoteArray([{ id: "1" }])).toBe(true);
    expect(looksLikeNoteArray([])).toBe(true);
  });

  it("rejects non-array or array of non-objects", () => {
    expect(looksLikeNoteArray({ notes: [] })).toBe(false);
    expect(looksLikeNoteArray(null)).toBe(false);
    expect(looksLikeNoteArray(["a", "b"])).toBe(false);
    expect(looksLikeNoteArray([1, 2])).toBe(false);
  });
});

describe("eksport HTML - wektory XSS (A03)", () => {
  it("MIME z cudzego data URL-a nie wstrzykuje atrybutu do <img>", async () => {
    // Nagłówek z cudzysłowem: po naiwnym odtworzeniu data URL-a zamknąłby atrybut src.
    const evil = 'data:x" onerror="window.__xss=1;base64,AAAA';
    const ref = await imageStore.putDataUrl(evil);
    await exportToHTML([makeNote({ images: [ref] })]);
    expect(capturedContent).not.toContain("onerror");
    expect(capturedContent).not.toMatch(/<img[^>]*src="data:x/);
  });

  it("obrazy spoza image/* nie są osadzane (data:text/html)", async () => {
    const ref = await imageStore.putDataUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==");
    await exportToHTML([makeNote({ images: [ref] })]);
    expect(capturedContent).not.toContain("text/html;base64");
    expect(capturedContent).not.toContain("<img");
  });

  it("escapuje etykiety, checklistę i nazwy załączników; plik niesie CSP bez skryptów", async () => {
    const payload = '"><img src=x onerror=alert(1)>';
    await exportToHTML([makeNote({
      title: payload, labels: [payload], checklist: [{ id: "c", text: payload, checked: false }],
      attachments: [{ hash: "a".repeat(64), name: payload, size: 1, type: "text/plain" }],
    })]);
    expect(capturedContent).not.toContain("<img src=x");
    expect(capturedContent).toContain("Content-Security-Policy");
    expect(capturedContent).toContain("default-src 'none'");
  });
});
