import { beforeEach, describe, expect, it } from "vitest";
import { SETTINGS_KEYS } from "@/lib/exportNotes";
import { pushErrorText } from "./client";
import { cleanPushToken, PUSH_PREFS_KEY, PUSH_TOKEN_KEY, PUSH_TOKEN_MAX, pushToken } from "./prefs";

// Token serwera powiadomień to sekret: nie wolno mu trafić do kopii zapasowej ani do wspólnego dokumentu.

beforeEach(() => { localStorage.clear(); pushToken.set(""); });

describe("token serwera powiadomień", () => {
  it("jest w osobnym kluczu, którego nie ma w kopii zapasowej, a ustawienia push (bez tokenu) są", () => {
    expect(PUSH_TOKEN_KEY).not.toBe(PUSH_PREFS_KEY);
    expect(SETTINGS_KEYS).not.toContain(PUSH_TOKEN_KEY);
    expect(SETTINGS_KEYS).toContain(PUSH_PREFS_KEY);
  });

  it("cleanPushToken: bez białych znaków (wklejone z nową linią), do 200 znaków", () => {
    expect(cleanPushToken("  abc def\n123 ")).toBe("abcdef123");
    expect(cleanPushToken("x".repeat(500))).toHaveLength(PUSH_TOKEN_MAX);
  });

  it("zapisuje się na urządzeniu i wraca po odczycie; śmieci z localStorage są czyszczone", () => {
    pushToken.set("sekret-0123456789abcdef-xyz");
    expect(localStorage.getItem(PUSH_TOKEN_KEY)).toContain("sekret-0123456789abcdef-xyz");
    expect(pushToken.get()).toBe("sekret-0123456789abcdef-xyz");
  });

  it("pushErrorText: czytelne komunikaty dla 401, 429 i 413", () => {
    expect(pushErrorText(401)).toMatch(/token/i);
    expect(pushErrorText(429)).toMatch(/ogranicza/);
    expect(pushErrorText(413)).toMatch(/za duży/);
    expect(pushErrorText(500)).toBe("Serwer odpowiedział 500");
  });
});
