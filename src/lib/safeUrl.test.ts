import { describe, it, expect } from "vitest";
import { isSafeHref, safeHref } from "./safeUrl";

describe("isSafeHref", () => {
  it.each([
    "https://example.com/a?b=c#d", "http://example.com", "mailto:ktos@example.com", "tel:+48123456789",
    "#kotwica", "/dzis", "./x", "../x", "?q=1", "notatka/podstrona", "HTTPS://EXAMPLE.COM",
  ])("przepuszcza %s", (u) => expect(isSafeHref(u)).toBe(true));

  it.each([
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)",
    "\u0000javascript:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox(1)", "blob:https://x/uuid",
    "file:///etc/passwd", "ftp://example.com", "about:blank", "", "   ",
  ])("odrzuca %j", (u) => expect(isSafeHref(u)).toBe(false));

  it("safeHref zwraca undefined dla niebezpiecznych", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref("https://a.pl")).toBe("https://a.pl");
  });
});
