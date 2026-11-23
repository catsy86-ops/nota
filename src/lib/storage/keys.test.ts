import { beforeEach, describe, expect, it } from "vitest";
import { backupKeyNames, defineKey, isSensitiveKey, jsonKey, readKey, registeredKeys, removeKey, writeKey } from "./keys";
import { SETTINGS_KEYS } from "@/lib/exportNotes";
import { APPEARANCE_KEYS } from "@/lib/appearanceCode";

const count = jsonKey("kaczy.test.count.v1", (v) => (typeof v === "number" && v >= 0 ? v : null), 3);

describe("rejestr kluczy localStorage (D6.1)", () => {
  beforeEach(() => localStorage.clear());

  it("brak wpisu → wartość domyślna; zapis i odczyt", () => {
    expect(readKey(count)).toBe(3);
    expect(writeKey(count, 7)).toBe(true);
    expect(localStorage.getItem("kaczy.test.count.v1")).toBe("7");
    expect(readKey(count)).toBe(7);
    removeKey(count);
    expect(readKey(count)).toBe(3);
  });

  it("zły kształt albo zepsuty JSON → wartość domyślna, bez wyjątku", () => {
    localStorage.setItem("kaczy.test.count.v1", '"tekst"');
    expect(readKey(count)).toBe(3);
    localStorage.setItem("kaczy.test.count.v1", "{zepsute");
    expect(readKey(count)).toBe(3);
  });

  it("klucz nie rejestruje się dwa razy, a wrażliwy nie może wejść do kopii", () => {
    expect(() => jsonKey("kaczy.test.count.v1", () => 1, 1)).toThrow();
    expect(() => defineKey({ key: "kaczy.test.zly.v1", parse: (r) => r, serialize: (v) => v, fallback: "", backup: true, sensitive: true })).toThrow();
  });
});

describe("lista kopii z rejestru (D6.5)", () => {
  it("SETTINGS_KEYS to klucze z flagą backup, bez powtórzeń", () => {
    expect(SETTINGS_KEYS).toEqual(backupKeyNames());
    expect(new Set(SETTINGS_KEYS).size).toBe(SETTINGS_KEYS.length);
  });

  it("cały wygląd jest w kopii", () => {
    for (const k of APPEARANCE_KEYS) expect(SETTINGS_KEYS).toContain(k);
  });

  it("żaden klucz wrażliwy nie wchodzi do kopii; kod parowania jest wrażliwy", () => {
    expect(isSensitiveKey("kaczy.sync.v1")).toBe(true);
    expect(SETTINGS_KEYS).not.toContain("kaczy.sync.v1");
    for (const d of registeredKeys()) expect(d.backup && d.sensitive).toBe(false);
  });
});
