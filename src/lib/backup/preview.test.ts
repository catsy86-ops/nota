import { describe, expect, it } from "vitest";
import type { FullBackup } from "@/lib/noteSchema";
import { backupPreview, describeBackupPreview } from "./preview";

const base = { version: 3, exportedAt: 0, notes: [{}, {}], labels: [], folders: [{}] } as unknown as FullBackup;

describe("podgląd kopii przed przywróceniem (U3.2)", () => {
  it("liczy notatki, dziennik, budowy, dni Grafiku i długi z sekcji", () => {
    const backup = {
      ...base,
      appVersion: "2026.11.27",
      study: JSON.stringify({ journal: [{}, {}, {}], sites: { a: {}, b: {} } }),
      shifts: JSON.stringify({ days: { "2026-11-01": {}, "2026-11-02": {} } }),
      debts: JSON.stringify([{}]),
    } as FullBackup;
    const p = backupPreview(backup);
    expect(p).toEqual({ notes: 2, folders: 1, journal: 3, sites: 2, shiftDays: 2, debts: 1, appVersion: "2026.11.27" });
    expect(describeBackupPreview(p)).toBe("2 notatki, 1 folder, 3 wpisy dziennika na 2 budowach, 2 dni Grafiku, 1 dług");
  });

  it("brak sekcji i zły JSON nie przerywają podglądu", () => {
    const p = backupPreview({ ...base, study: "{zły", shifts: undefined } as FullBackup);
    expect(p).toEqual({ notes: 2, folders: 1 });
    expect(describeBackupPreview(p)).toBe("2 notatki, 1 folder");
  });
});
