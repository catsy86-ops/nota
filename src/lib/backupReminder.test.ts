import { afterEach, describe, expect, it } from "vitest";
import { isBackupDue, markBackup, oldestCreatedAt } from "./backupReminder";

const D = 24 * 60 * 60 * 1000;

describe("isBackupDue", () => {
  afterEach(() => localStorage.clear());

  it("bez backupu liczy od najstarszej notatki", () => {
    expect(isBackupDue(7, Date.now() - 2 * D)).toBe(false);
    expect(isBackupDue(7, Date.now() - 8 * D)).toBe(true);
  });

  it("pusta baza i wyłączone przypomnienie nigdy nie są zaległe", () => {
    expect(isBackupDue(7, null)).toBe(false);
    expect(isBackupDue(0, Date.now() - 100 * D)).toBe(false);
  });

  it("świeży backup wygrywa ze starą notatką", () => {
    markBackup();
    expect(isBackupDue(7, Date.now() - 100 * D)).toBe(false);
  });
});

describe("oldestCreatedAt", () => {
  it("bierze minimum ze wszystkich list", () => {
    expect(oldestCreatedAt([{ createdAt: 5 }, { createdAt: 3 }], [{ createdAt: 4 }])).toBe(3);
    expect(oldestCreatedAt([], [])).toBeNull();
  });
});
