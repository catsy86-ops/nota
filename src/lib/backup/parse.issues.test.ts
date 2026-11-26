import { describe, expect, it } from "vitest";
import { backupIssues, describeBackupIssues, parseFullBackup } from "./parse";

/** Z-18.2 (P3, P4 audytu 2): nowsza kopia w starszej aplikacji i sekcje uszkodzone na poziomie schematu. */
const base = { version: 3, exportedAt: 1, notes: [], labels: [], folders: [] };
const parse = (over: Record<string, unknown>) => parseFullBackup(JSON.stringify({ ...base, ...over }));

describe("wczytanie kopii — uwagi przed przywróceniem (Z-18.2)", () => {
  it("klucz z nowszego działu → ostrzeżenie z nazwą sekcji i wersją aplikacji", async () => {
    const backup = await parse({ przyszlyDzial: "[]", appVersion: "2027.01.02" });
    expect(backupIssues(backup).unknown).toEqual(["przyszlyDzial"]);
    const [line] = describeBackupIssues(backupIssues(backup));
    expect(line).toContain("nowszej wersji aplikacji (2027.01.02)");
    expect(line).toContain("przyszlyDzial");
  });

  it("sekcja wymieniona w `sections`, której ta wersja nie zna, też jest nieznana", async () => {
    const backup = await parse({ sections: ["notes", "przyszlyDzial"] });
    expect(backupIssues(backup).unknown).toEqual(["przyszlyDzial"]);
  });

  it("`debts: 5` → sekcja uszkodzona, nie cichy brak", async () => {
    const backup = await parse({ debts: 5, labels: "zle" });
    expect(backup.debts).toBeUndefined();
    expect(backupIssues(backup).corrupt).toEqual(["labels", "debts"]);
    expect(describeBackupIssues(backupIssues(backup))).toEqual(["Uszkodzone w pliku, pominięte: Etykiety, Długi."]);
  });

  it("poprawna kopia nie ma uwag", async () => {
    const backup = await parse({ debts: "[]", weight: "[]", sections: ["version", "notes", "debts", "weight"] });
    expect(backupIssues(backup)).toEqual({ unknown: [], corrupt: [] });
    expect(describeBackupIssues(backupIssues(backup))).toEqual([]);
  });

  it("sekcja `weight` przechodzi przez wczytanie (wcześniej schemat ją wycinał)", async () => {
    const weight = JSON.stringify([{ day: "2026-11-01", kg: 80, created: 1 }]);
    expect((await parse({ weight })).weight).toBe(weight);
  });

  it.each([["4"], [0], [2.5], [null]])("`version: %j` → odmowa zamiast wczytania jako 1", async (version) => {
    await expect(parse({ version })).rejects.toThrow("nieznaną wersję formatu");
  });

  it("brak `version` (najstarsze kopie) dalej się wczytuje", async () => {
    const { version: _drop, ...noVersion } = base;
    void _drop;
    await expect(parseFullBackup(JSON.stringify(noVersion))).resolves.toMatchObject({ version: 1 });
  });
});
