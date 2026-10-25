import { describe, expect, it } from "vitest";
import { foldName, siteKey } from "./siteKey";

// Klucz budowy musi być ten sam na każdym urządzeniu i niezależny od ogonków (Etap 5 § 5.6).
describe("siteKey: klucze i nazwy budów", () => {
  it("nazwa w innej wielkości liter i z ogonkami daje ten sam klucz", () => {
    expect(siteKey("Łąkowa 5")).toBe(siteKey("lakowa 5"));
    expect(siteKey("Lipowa 5")).toBe(siteKey("lipowa 5"));
  });

  it("różne nazwy dają różne klucze", () => {
    expect(siteKey("Lipowa 5")).not.toBe(siteKey("Lipowa 7"));
  });

  it("klucz ma stały kształt n-xxxxxxxx", () => {
    expect(siteKey("Polna 2")).toMatch(/^n-[0-9a-f]{8}$/);
  });

  it("foldName ujednolica spacje i wielkość liter", () => {
    expect(foldName("  Dom   Nowaków ")).toBe("dom nowakow");
  });
});
