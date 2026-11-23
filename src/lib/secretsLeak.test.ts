import { beforeEach, describe, expect, it } from "vitest";
import { buildFullBackup, SETTINGS_KEYS } from "./exportNotes";
import { collectDiagReport } from "./diagnosticsReport";
import { backupKeyNames, isSensitiveKey, registeredKeys } from "./storage/keys";
import { clearAllStorage } from "./notesStore";
import { yjsStore } from "./yjsStore";

/**
 * S1.5(a): sekrety leżą jawnie w `localStorage` (kod synchronizacji, token powiadomień, adres przekaźnika, pin i próby
 * skarbca, numer konta), więc muszą zostać poza kopią JSON i raportem diagnostycznym. Test wpisuje w każdy klucz oznaczony
 * jako wrażliwy unikalny znacznik i szuka go w wynikach — nowy sekret dopisany do rejestru jest sprawdzany sam.
 */
const marker = (key: string) => `SEKRET<${key}>`;
const sensitive = () => registeredKeys().filter((d) => d.sensitive).map((d) => d.key);

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
  await yjsStore.resetForTests();
});

describe("sekrety poza kopią i raportem (S1.5)", () => {
  it("rejestr oznacza jako wrażliwe: kod synchronizacji, token powiadomień, adres przekaźnika, pin i próby skarbca", () => {
    for (const k of ["kaczy.sync.v1", "kaczy.push.token.v1", "kaczy.relay.v1", "kaczy.vault.pin.v1", "kaczy.vault.attempts.v1"]) {
      expect(isSensitiveKey(k), k).toBe(true);
    }
  });

  it("żaden klucz wrażliwy nie jest na liście kopii", () => {
    const backup = new Set(backupKeyNames());
    expect(sensitive().filter((k) => backup.has(k))).toEqual([]);
    expect(SETTINGS_KEYS.filter(isSensitiveKey)).toEqual([]);
  });

  it("kopia JSON nie zawiera wartości żadnego klucza wrażliwego", async () => {
    for (const k of sensitive()) localStorage.setItem(k, marker(k));
    const text = JSON.stringify(await buildFullBackup());
    for (const k of sensitive()) expect(text, k).not.toContain(marker(k));
  });

  it("raport diagnostyczny nie zawiera wartości żadnego klucza wrażliwego", async () => {
    for (const k of sensitive()) localStorage.setItem(k, marker(k));
    const report = await collectDiagReport();
    for (const k of sensitive()) expect(report, k).not.toContain(marker(k));
  });
});
