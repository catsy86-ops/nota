import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDiagReport, clearErrorLog, clearErrorLogForTests, ERROR_LOG_MAX, errorLogText, flushErrorLogForTests, getErrorLog, logDeviceError, redactErrorText, type DiagSnapshot } from "./diagnostics";
import { DANE } from "./storage/names";

afterEach(() => { clearErrorLogForTests(); vi.useRealTimers(); });

describe("dziennik błędów urządzenia (Q1.6)", () => {
  it("przeżywa przeładowanie (localStorage) i zlicza ten sam błąd pod rząd", () => {
    logDeviceError("uncaught", new TypeError("x is undefined"));
    logDeviceError("uncaught", new TypeError("x is undefined"));
    logDeviceError("rejection", "fetch failed");
    expect(localStorage.getItem(DANE.errorLog)).toBeNull();
    flushErrorLogForTests();
    const stored = JSON.parse(localStorage.getItem(DANE.errorLog)!);
    expect(stored).toHaveLength(2);
    clearErrorLogForTests();
    localStorage.setItem(DANE.errorLog, JSON.stringify(stored));
    expect(getErrorLog().map((e) => [e.source, e.message, e.count])).toEqual([["uncaught", "TypeError: x is undefined", 2], ["rejection", "fetch failed", 1]]);
  });

  it("zapis do localStorage zbiorczo po pół sekundy, nie przy każdym błędzie", () => {
    vi.useFakeTimers();
    const set = vi.spyOn(Storage.prototype, "setItem");
    for (let i = 0; i < 60; i++) logDeviceError("uncaught", "pętla");
    expect(set).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(set).toHaveBeenCalledTimes(1);
    expect(getErrorLog()[0].count).toBe(60);
    set.mockRestore();
  });

  it("cytowane dane z komunikatu (np. fragment JSON-u z treścią notatki) nie trafiają do dziennika", () => {
    logDeviceError("rejection", new SyntaxError(`Unexpected token 'M', "Moje hasło do banku"... is not valid JSON`));
    expect(getErrorLog()[0].message).toBe("SyntaxError: Unexpected token …, …... is not valid JSON");
    expect(redactErrorText("x `a` y")).toBe("x … y");
  });

  it("najwyżej 50 wpisów, najstarsze odpadają", () => {
    for (let i = 0; i < ERROR_LOG_MAX + 5; i++) logDeviceError("uncaught", `błąd ${i}`);
    const list = getErrorLog();
    expect(list).toHaveLength(ERROR_LOG_MAX);
    expect(list[0].message).toBe("błąd 5");
  });

  it("czyści tekst: jedna linia, adres bez ścieżki i zapytania, najwyżej 160 znaków", () => {
    logDeviceError("rejection", `zły\nadres https://example.com/notatka/sekret?k=1 ${"a".repeat(300)}`);
    const [e] = getErrorLog();
    expect(e.message).not.toContain("\n");
    expect(e.message).toContain("https://example.com");
    expect(e.message).not.toContain("sekret");
    expect(e.message.length).toBeLessThanOrEqual(160);
  });

  it("uszkodzony zapis daje pustą listę; złe wpisy odpadają", () => {
    localStorage.setItem(DANE.errorLog, "{nie json");
    expect(getErrorLog()).toEqual([]);
    clearErrorLogForTests();
    localStorage.setItem(DANE.errorLog, JSON.stringify([{ at: 1, source: "s", message: "m" }, { at: "x" }, null]));
    expect(getErrorLog()).toEqual([{ at: 1, source: "s", message: "m", count: 1 }]);
  });

  it("clearErrorLog usuwa klucz; tekst do schowka od najnowszego; raport ma sekcję", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 10, 25, 10));
    logDeviceError("uncaught", "pierwszy");
    vi.setSystemTime(Date.UTC(2026, 10, 25, 11));
    logDeviceError("rejection", "drugi");
    expect(errorLogText(getErrorLog())).toBe("2026-11-25T11:00:00.000Z [rejection] drugi\n2026-11-25T10:00:00.000Z [uncaught] pierwszy");
    const snap = { build: "b", generatedAt: "g", userAgent: "u", online: true, serviceWorker: "s", storage: { usage: null, quota: null, persisted: null }, counts: { notes: 0, archived: 0, trashed: 0, folders: 0, labels: 0 }, stateVectorBytes: 0, sync: { status: "x", peerCount: 0, paired: false, lastSyncedAt: null, lastError: null } } as DiagSnapshot;
    expect(buildDiagReport(snap, [], [], [], getErrorLog())).toContain("błędy z tego urządzenia, także z poprzednich sesji (2):\n2026-11-25T11:00:00.000Z [rejection] drugi");
    flushErrorLogForTests();
    expect(localStorage.getItem(DANE.errorLog)).not.toBeNull();
    clearErrorLog();
    expect(localStorage.getItem(DANE.errorLog)).toBeNull();
    expect(getErrorLog()).toEqual([]);
  });
});
