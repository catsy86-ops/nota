import { describe, it, expect } from "vitest";
import { buildIcs, escapeText, exportableReminders, foldLine, formatLocal } from "./icsExport";
import type { Note } from "@/hooks/useNotes";

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "Dentysta", content: "", color: "default", pinned: false, archived: false,
    trashed: false, trashedAt: null, labels: [], reminder: new Date(2026, 9, 5, 9, 30).getTime(),
    priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0,
    ...overrides,
  };
}

const NOW = new Date(2026, 8, 27, 12, 0).getTime();

describe("buildIcs", () => {
  it("jednorazowy termin: czas lokalny, UID notatki, alarm w chwili terminu, CRLF", () => {
    const ics = buildIcs([note()], NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:n1@notatnik\r\n");
    expect(ics).toContain("DTSTART:20261005T093000\r\n");
    expect(ics).toContain("DTEND:20261005T094500\r\n");
    expect(ics).toContain("SUMMARY:Dentysta\r\n");
    expect(ics).toContain("TRIGGER:PT0M\r\n");
    expect(ics).not.toContain("RRULE");
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it.each([
    ["daily", "RRULE:FREQ=DAILY"],
    ["weekly", "RRULE:FREQ=WEEKLY"],
    ["monthly", "RRULE:FREQ=MONTHLY"],
  ] as const)("seria %s → %s", (repeat, rule) => {
    expect(buildIcs([note({ reminderRepeat: repeat })], NOW)).toContain(`${rule}\r\n`);
  });

  it("godzina ścienna przetrwa zmianę czasu (czas pływający, bez Z)", () => {
    // 29 marca 2026 w Polsce zmiana na czas letni — 9:00 zostaje 9:00.
    expect(formatLocal(new Date(2026, 2, 30, 9, 0).getTime())).toBe("20260330T090000");
    expect(buildIcs([note({ reminder: new Date(2026, 2, 30, 9, 0).getTime() })], NOW)).not.toMatch(/DTSTART:\d+T\d+Z/);
  });

  it("treść trafia do opisu z ucieczką znaków specjalnych", () => {
    const ics = buildIcs([note({ content: "a, b; c\\d\nnowa linia" })], NOW);
    expect(ics).toContain("DESCRIPTION:a\\, b\\; c\\\\d\\nnowa linia");
  });

  it("bez tytułu bierze pierwszą linię treści", () => {
    expect(buildIcs([note({ title: " ", content: "Kupić mleko\nreszta" })], NOW)).toContain("SUMMARY:Kupić mleko\r\n");
  });
});

describe("foldLine / escapeText", () => {
  it("zawija po 75 bajtach, nie tnąc polskich znaków", () => {
    const folded = foldLine("SUMMARY:" + "ż".repeat(60));
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "ż".repeat(60));
  });

  it("krótka linia bez zmian", () => {
    expect(foldLine("VERSION:2.0")).toBe("VERSION:2.0");
    expect(escapeText("zwykły tekst")).toBe("zwykły tekst");
  });
});

describe("exportableReminders", () => {
  it("bierze przyszłe terminy i serie, pomija przeszłe jednorazowe, kosz i brak terminu", () => {
    const past = new Date(2026, 0, 1).getTime();
    const ids = exportableReminders([
      note({ id: "future" }),
      note({ id: "past", reminder: past }),
      note({ id: "past-series", reminder: past, reminderRepeat: "weekly" }),
      note({ id: "trash", trashed: true }),
      note({ id: "none", reminder: null }),
    ], NOW).map((n) => n.id);
    expect(ids).toEqual(["future", "past-series"]);
  });
});
