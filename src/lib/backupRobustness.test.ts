import { describe, expect, it } from "vitest";
import { fullBackupSchema, noteSchema } from "./noteSchema";

// Audyt 2026-11-11 (K1, K2): kopia nie może kasować notatek przez jeden zły element ani gubić reguł powtarzania.

const base = { id: "n1", title: "Zakupy", content: "x", createdAt: 1, updatedAt: 1 };

describe("kopia pełna: odporność na uszkodzone elementy", () => {
  it("jeden zły element nie zeruje tablicy notatek ani folderów", () => {
    const parsed = fullBackupSchema.parse({
      version: 3, exportedAt: 1,
      notes: [base, null, 5, "x", { ...base, id: "n2", title: "Druga" }],
      folders: [null, { id: "f1", name: "Praca" }, 7],
    });
    expect(parsed.notes.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(parsed.folders.map((f) => f.id)).toEqual(["f1"]);
  });

  it("notes niebędące tablicą dają pustą listę, nie wyjątek", () => {
    expect(fullBackupSchema.parse({ version: 3, notes: "oops", folders: {} }).notes).toEqual([]);
    expect(fullBackupSchema.parse({ version: 3 }).folders).toEqual([]);
  });
});

describe("reguła powtarzania (reminderRule) przeżywa kopię i import", () => {
  it.each([
    [{ kind: "workdays" }],
    [{ kind: "biweekly" }],
    [{ kind: "yearly" }],
    [{ kind: "weekdays", days: [1, 3, 5] }],
    [{ kind: "every", every: 3 }],
  ])("zachowuje %j", (rule) => {
    expect(noteSchema.parse({ ...base, reminderRule: rule }).reminderRule).toEqual(rule);
    const viaBackup = fullBackupSchema.parse({ version: 3, notes: [{ ...base, reminderRule: rule }] });
    expect(viaBackup.notes[0].reminderRule).toEqual(rule);
  });

  it("zła reguła jest pomijana, notatka zostaje", () => {
    for (const bad of [{ kind: "co-sekundę" }, { kind: "every", every: 0 }, { kind: "weekdays", days: [9] }, "x", 5]) {
      const n = noteSchema.parse({ ...base, reminderRule: bad });
      expect(n.reminderRule, JSON.stringify(bad)).toBeUndefined();
      expect(n.title).toBe("Zakupy");
    }
  });
});
