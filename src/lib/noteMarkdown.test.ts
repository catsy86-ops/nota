import { describe, it, expect, vi, beforeEach } from "vitest";
import { noteToMarkdown, noteToPlainText, copyNoteToClipboard } from "./noteMarkdown";
import type { Note } from "@/hooks/useNotes";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const base: Note = {
  id: "1", title: "Zakupy", content: "Na weekend", color: "default", pinned: false, archived: false, trashed: false,
  trashedAt: null, labels: ["dom", "pilne"], reminder: null, priority: "none", images: ["data:image/png;base64,AAAA"],
  checklist: [{ id: "a", text: "mleko", checked: true }, { id: "b", text: "chleb", checked: false }],
  folderId: null, order: 0, createdAt: 0, updatedAt: 0,
};

describe("noteToMarkdown", () => {
  it("serialises title, labels, content and checklist, without images", () => {
    expect(noteToMarkdown(base)).toBe("# Zakupy\n*Etykiety: dom, pilne*\n\nNa weekend\n\n- [x] mleko\n- [ ] chleb");
  });

  it("handles an untitled, content-only note", () => {
    expect(noteToMarkdown({ ...base, title: "", labels: [], checklist: [] })).toBe("Na weekend");
  });

  it("includes the reminder line", () => {
    const out = noteToMarkdown({ ...base, reminder: new Date(2026, 9, 10, 9, 30).getTime() });
    expect(out).toContain("*Przypomnienie: 10 paź 2026, 09:30*");
  });
});

describe("noteToPlainText", () => {
  it("uses ballot boxes and no markup", () => {
    expect(noteToPlainText(base)).toBe("Zakupy\n\nNa weekend\n\n☑ mleko\n☐ chleb");
  });
});

describe("copyNoteToClipboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes to the clipboard and toasts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    expect(await copyNoteToClipboard(base)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(noteToMarkdown(base));
    expect(toast.success).toHaveBeenCalledWith("Skopiowano");
  });

  it("reports a clipboard failure", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("no")) } });
    expect(await copyNoteToClipboard(base, "text")).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});
