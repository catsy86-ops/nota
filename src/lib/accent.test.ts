import { beforeEach, describe, expect, it } from "vitest";
import { accentFor, setAccent } from "@/lib/accent";
import { setSkin } from "@/lib/skins";

beforeEach(() => {
  setSkin("zeszyt");
  for (const s of ["zeszyt", "neon"] as const) setAccent(s, 0);
});

describe("akcent — osobno dla każdego stylu", () => {
  it("ustawia data-accent dla bieżącego stylu, 0 zdejmuje atrybut", () => {
    setAccent("zeszyt", 2);
    expect(document.documentElement.dataset.accent).toBe("2");
    setAccent("zeszyt", 0);
    expect(document.documentElement.dataset.accent).toBeUndefined();
  });

  it("zmiana stylu przełącza na akcent zapamiętany dla tego stylu", () => {
    setAccent("zeszyt", 1);
    setAccent("neon", 3);
    setSkin("neon");
    expect(document.documentElement.dataset.accent).toBe("3");
    setSkin("zeszyt");
    expect(document.documentElement.dataset.accent).toBe("1");
    expect(accentFor("plan")).toBe(0);
  });

  it("odrzuca numer spoza listy", () => {
    setAccent("zeszyt", 9);
    expect(accentFor("zeszyt")).toBe(0);
  });
});
