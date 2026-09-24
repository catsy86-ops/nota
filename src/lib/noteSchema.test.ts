import { describe, it, expect } from "vitest";
import { folderSchema, fullBackupSchema } from "./noteSchema";

// `noteSchema` and `looksLikeNoteArray` already have coverage in exportNotes.test.ts;
// this file covers the two exports that don't: `folderSchema` and `fullBackupSchema`.

describe("folderSchema", () => {
  it("accepts a well-formed folder unchanged", () => {
    const folder = { id: "f1", name: "Praca", color: "sky", emoji: "💼", parentId: null, order: 2, createdAt: 100, updatedAt: 200 };
    expect(folderSchema.parse(folder)).toEqual(folder);
  });

  it("fills in fallbacks for missing/malformed fields", () => {
    const parsed = folderSchema.parse({ id: "f2", name: "X", color: "not-a-real-color" });
    expect(parsed.id).toBe("f2");
    expect(parsed.color).toBe("default");
    expect(parsed.emoji).toBeNull();
    expect(parsed.parentId).toBeNull();
    expect(parsed.order).toBe(0);
    expect(typeof parsed.createdAt).toBe("number");
  });

  it("generates an id when missing", () => {
    const parsed = folderSchema.parse({ name: "No id" });
    expect(typeof parsed.id).toBe("string");
    expect(parsed.id.length).toBeGreaterThan(0);
  });

  it("leaves updatedAt undefined when absent (legacy folders predate the field)", () => {
    const parsed = folderSchema.parse({ id: "f3", name: "Legacy" });
    expect(parsed.updatedAt).toBeUndefined();
  });
});

describe("fullBackupSchema", () => {
  it("accepts a well-formed backup unchanged in shape", () => {
    const backup = {
      version: 1 as const,
      exportedAt: 12345,
      notes: [],
      labels: ["dom", "praca"],
      folders: [{ id: "f1", name: "Praca", color: "default", emoji: null, parentId: null, order: 0, createdAt: 0 }],
    };
    const parsed = fullBackupSchema.parse(backup);
    expect(parsed.version).toBe(1);
    expect(parsed.labels).toEqual(["dom", "praca"]);
    expect(parsed.folders).toHaveLength(1);
  });

  it("recursively validates notes and folders, dropping malformed ones to fallbacks rather than throwing", () => {
    const backup = {
      version: 1,
      notes: [{ id: "n1", title: "T", color: "bogus" }],
      folders: [{ id: "f1", color: "also-bogus" }],
    };
    const parsed = fullBackupSchema.parse(backup);
    expect(parsed.notes[0].color).toBe("default");
    expect(parsed.folders[0].color).toBe("default");
  });

  it("falls back to safe defaults for a completely empty/malformed object", () => {
    const parsed = fullBackupSchema.parse({});
    expect(parsed.version).toBe(1);
    expect(parsed.notes).toEqual([]);
    expect(parsed.labels).toEqual([]);
    expect(parsed.folders).toEqual([]);
    expect(typeof parsed.exportedAt).toBe("number");
  });
});
