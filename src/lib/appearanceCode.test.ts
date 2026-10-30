import { describe, expect, it } from "vitest";
import { appearanceLink, applyAppearanceValues, codeFromHash, decodeAppearance, encodeAppearance, resetAppearance, snapshotAppearance } from "@/lib/appearanceCode";
import { setShape } from "@/lib/shape";

const shapeNow = () => document.documentElement.dataset.shape ?? "normal";

describe("kod wyglądu", () => {
  const stored: Record<string, string> = {
    "kaczy.skin.v1": JSON.stringify("tablica"),
    "kaczy.accent.v1": JSON.stringify({ tablica: 2 }),
    "kaczy.font.v1": JSON.stringify("literata"),
    "kaczy.vault.autolock.v1": "sekret",
  };
  const read = (k: string) => stored[k] ?? null;

  it("koduje i odczytuje tylko klucze wyglądu (z polskimi znakami)", () => {
    const code = encodeAppearance((k) => (k === "kaczy-theme" ? "ciemny — żółw" : read(k)));
    expect(code.startsWith("NOTKI1-")).toBe(true);
    expect(code).not.toMatch(/[+/=]/);
    const back = decodeAppearance(code)!;
    expect(back["kaczy.skin.v1"]).toBe(JSON.stringify("tablica"));
    expect(back["kaczy-theme"]).toBe("ciemny — żółw");
    expect(back).not.toHaveProperty("kaczy.vault.autolock.v1");
  });

  it("odrzuca obcy tekst, zły prefiks i uszkodzony kod; ignoruje spacje i nowe linie", () => {
    expect(decodeAppearance("hello")).toBeNull();
    expect(decodeAppearance("NOTKI1-!!!")).toBeNull();
    expect(decodeAppearance("NOTKI1-" + btoa("[1,2]"))).toBeNull();
    const code = encodeAppearance(read);
    expect(decodeAppearance(`  ${code.slice(0, 20)}\n${code.slice(20)} `)).not.toBeNull();
  });

  it("nie przepuszcza kluczy spoza listy podanych w kodzie", () => {
    const evil = "NOTKI1-" + btoa(JSON.stringify({ "kaczy.sync.v1": "x", "kaczy.shape.v1": JSON.stringify("soft") }));
    expect(decodeAppearance(evil)).toEqual({ "kaczy.shape.v1": JSON.stringify("soft") });
  });
});

describe("ramki i poświata w kodzie wyglądu", () => {
  it("klucze ramek i poświaty przechodzą w obie strony", () => {
    const store: Record<string, string> = {
      "kaczy.frames.v1": JSON.stringify("strong"),
      "kaczy.frames.look.v1": JSON.stringify({ color: "copper", surface: "mint" }),
      "kaczy.glow.v1": JSON.stringify({ strength: "strong", color: "blue" }),
    };
    const code = encodeAppearance((k) => store[k] ?? null);
    expect(decodeAppearance(code)).toEqual(store);
  });
});

describe("wygląd bez przeładowania (plan motywów 2026-10-30, 1.4)", () => {
  it("reset wraca do domyślnych, a „Cofnij” przywraca poprzedni stan — magazyny czytają się od razu", () => {
    localStorage.clear();
    setShape("soft");
    localStorage.setItem("kaczy.vault.autolock.v1", "zostaje");
    expect(snapshotAppearance()).toEqual({ "kaczy.shape.v1": JSON.stringify("soft") });
    const before = resetAppearance();
    expect(shapeNow()).toBe("normal");
    expect(localStorage.getItem("kaczy.shape.v1")).toBeNull();
    expect(localStorage.getItem("kaczy.vault.autolock.v1")).toBe("zostaje");
    applyAppearanceValues(before, { replace: true });
    expect(shapeNow()).toBe("soft");
  });

  it("bez `replace` brakujące klucze zostają", () => {
    localStorage.clear();
    setShape("sharp");
    applyAppearanceValues({ "kaczy.font.v1": JSON.stringify("literata") }, { replace: false });
    expect(shapeNow()).toBe("sharp");
    expect(localStorage.getItem("kaczy.font.v1")).toBe(JSON.stringify("literata"));
  });
});

describe("link z kodem wyglądu (plan motywów 1.5)", () => {
  it("link zawiera kod i wraca z fragmentu adresu; obcy fragment i zły kod są odrzucane", () => {
    const code = encodeAppearance((k) => (k === "kaczy.skin.v1" ? JSON.stringify("neon") : null));
    const link = appearanceLink(code, "https://notki.example/");
    expect(link.startsWith("https://notki.example/#wyglad=")).toBe(true);
    expect(codeFromHash(new URL(link).hash)).toBe(code);
    expect(codeFromHash("#inne=1")).toBeNull();
    expect(codeFromHash("#wyglad=nie-kod")).toBeNull();
  });
});
