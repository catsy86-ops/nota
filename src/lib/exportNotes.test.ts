import { describe, it, expect, beforeEach, vi } from "vitest";
import { exportToJSON, exportToMarkdown, exportToHTML } from "./exportNotes";
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

  const realCreateElement = document.createElement.bind(document);
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

describe("exportToJSON", () => {
  it("serializes the full note list, including images, and returns filename/size", () => {
    const note = makeNote({ images: ["data:image/png;base64,AAA"] });
    const { filename, size } = exportToJSON([note]);

    expect(filename).toMatch(/^kaczy-backup-.*\.json$/);
    expect(size).toBeGreaterThan(0);
    expect(capturedType).toBe("application/json");

    const parsed = JSON.parse(capturedContent);
    expect(parsed).toEqual([note]);
    // Unlike the HTML/Markdown/PDF exports, JSON keeps images — it's the
    // only format that round-trips a note completely (see exportToHTML/
    // exportToMarkdown tests below for the known limitation).
    expect(parsed[0].images).toEqual(["data:image/png;base64,AAA"]);
  });

  it("uses a custom filename when provided", () => {
    const { filename } = exportToJSON([makeNote()], "custom.json");
    expect(filename).toBe("custom.json");
  });
});

describe("exportToMarkdown", () => {
  it("includes title, labels, reminder and checklist", () => {
    const note = makeNote({
      labels: ["dom"],
      reminder: new Date(2026, 0, 1, 9, 0).getTime(),
      checklist: [{ id: "c1", text: "Mleko", checked: true }, { id: "c2", text: "Chleb", checked: false }],
    });
    exportToMarkdown([note]);

    expect(capturedFilename).toBe("kaczy-export.md");
    expect(capturedContent).toContain("## Zakupy");
    expect(capturedContent).toContain("*Etykiety: dom*");
    expect(capturedContent).toContain("Mleko, chleb");
    expect(capturedContent).toContain("- [x] Mleko");
    expect(capturedContent).toContain("- [ ] Chleb");
  });

  it("KNOWN LIMITATION: does not include note images at all", () => {
    const note = makeNote({ images: ["data:image/png;base64,AAA"] });
    exportToMarkdown([note]);
    expect(capturedContent).not.toContain("data:image");
    expect(capturedContent).not.toContain("![");
  });
});

describe("exportToHTML", () => {
  it("escapes title/content to prevent HTML/script injection", () => {
    const note = makeNote({ title: "<script>alert(1)</script>", content: "a & b < c" });
    exportToHTML([note]);

    expect(capturedContent).not.toContain("<script>alert(1)</script>");
    expect(capturedContent).toContain("&lt;script&gt;");
    expect(capturedContent).toContain("a &amp; b &lt; c");
  });

  it("KNOWN LIMITATION: does not render note images at all", () => {
    const note = makeNote({ images: ["data:image/png;base64,AAA"] });
    exportToHTML([note]);
    expect(capturedContent).not.toContain("<img");
    expect(capturedContent).not.toContain("data:image");
  });
});
