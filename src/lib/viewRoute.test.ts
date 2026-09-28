import { describe, it, expect } from "vitest";
import { parseViewRoute, viewPath, withSearch, notePath } from "./viewRoute";
import type { View } from "@/hooks/useFilteredNotes";

describe("viewRoute", () => {
  it("round-trips every simple view", () => {
    const views: View[] = ["notes", "today", "week", "archive", "reminders", "calendar", "widget", "trash"];
    for (const v of views) expect(parseViewRoute(viewPath(v), "").view).toBe(v);
  });

  it("round-trips folders and labels with special characters", () => {
    expect(parseViewRoute(viewPath("folder", { folder: "a/b c" }), "")).toMatchObject({ view: "folder", folder: "a/b c" });
    expect(parseViewRoute(viewPath("label", { label: "praca #1 ż" }), "")).toMatchObject({ view: "label", label: "praca #1 ż" });
  });

  it("falls back to notes for unknown or incomplete paths", () => {
    expect(parseViewRoute("/cos-dziwnego", "").view).toBe("notes");
    expect(parseViewRoute("/folder", "").view).toBe("notes");
    expect(parseViewRoute("/kosz/x", "").view).toBe("notes");
    expect(viewPath("folder")).toBe("/");
  });

  it("reads the search query and note deep link", () => {
    expect(parseViewRoute("/kosz", "?q=label%3Apraca").search).toBe("label:praca");
    expect(parseViewRoute(notePath("abc-1"), "")).toMatchObject({ noteId: "abc-1", view: "notes" });
  });

  it("keeps other query params when changing q", () => {
    expect(withSearch("?pair=XYZ", "kot")).toBe("?pair=XYZ&q=kot");
    expect(withSearch("?pair=XYZ&q=kot", "")).toBe("?pair=XYZ");
    expect(withSearch("", "")).toBe("");
  });
});
