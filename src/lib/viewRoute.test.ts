import { describe, it, expect } from "vitest";
import { parseViewRoute, viewPath, withSearch, notePath, calendarDayFromSearch } from "./viewRoute";
import type { View } from "@/hooks/useFilteredNotes";

describe("viewRoute", () => {
  it("round-trips every simple view", () => {
    const views: View[] = ["notes", "today", "week", "archive", "reminders", "calendar", "shifts", "widget", "trash"];
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

describe("dział Praca (dawniej Nauka)", () => {
  it("nowy i stary adres prowadzą do tego samego widoku, linki budują nowy", () => {
    expect(parseViewRoute("/praca", "").view).toBe("study");
    expect(parseViewRoute("/nauka", "").view).toBe("study");
    expect(viewPath("study")).toBe("/praca");
  });
});

describe("adres dnia w kalendarzu (K1.5)", () => {
  it("bierze dzien=YYYY-MM-DD, a zły format odrzuca", () => {
    expect(calendarDayFromSearch("?dzien=2026-10-05")).toBe("2026-10-05");
    expect(calendarDayFromSearch("?dzien=05.10.2026")).toBeNull();
    expect(calendarDayFromSearch("?dzien=2026-10-5")).toBeNull();
    expect(calendarDayFromSearch("")).toBeNull();
  });

  it("ścieżka kalendarza z dniem nadal wskazuje na kalendarz", () => {
    expect(parseViewRoute("/kalendarz", "?dzien=2026-10-05").view).toBe("calendar");
  });
});
