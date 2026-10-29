import { describe, expect, it } from "vitest";
import { decodeAppearance, encodeAppearance } from "@/lib/appearanceCode";

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
