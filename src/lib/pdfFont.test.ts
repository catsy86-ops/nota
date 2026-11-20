import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Czcionka dokumentów PDF ma mieć zwykłe litery, cyfry i polskie znaki w jednym pliku (W8.2). Wcześniej
 * `protokol-*.ttf` był samym podzbiorem `latin-ext` — w PDF-ach znikały A–Z, a–z, cyfry i „ó”, a testy tego nie widziały.
 * Plik buduje `scripts/build-pdf-font.mjs`.
 */
function cmapCodes(path: string): Set<number> {
  const b = readFileSync(path);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let cmap = 0;
  for (let i = 0; i < dv.getUint16(4); i++) {
    const o = 12 + i * 16;
    if (b.toString("latin1", o, o + 4) === "cmap") cmap = dv.getUint32(o + 8);
  }
  const codes = new Set<number>();
  for (let i = 0; i < dv.getUint16(cmap + 2); i++) {
    const off = cmap + dv.getUint32(cmap + 8 + i * 8);
    if (dv.getUint16(off) !== 4) continue;
    const seg = dv.getUint16(off + 6) / 2;
    for (let s = 0; s < seg; s++) {
      const end = dv.getUint16(off + 14 + s * 2);
      const start = dv.getUint16(off + 16 + seg * 2 + s * 2);
      for (let c = start; c <= end && c < 0xffff; c++) codes.add(c);
    }
  }
  return codes;
}

const NEEDED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ĄĆĘŁŃÓŚŹŻąćęłńóśźż .,:;!?()[]/%+-=×·–—„”\"'#&*@";

describe("czcionka PDF", () => {
  for (const name of ["protokol-regular.ttf", "protokol-bold.ttf"]) {
    it(`${name}: litery, cyfry i polskie znaki`, () => {
      const codes = cmapCodes(resolve(process.cwd(), "public/fonts", name));
      const missing = [...NEEDED].filter((ch) => !codes.has(ch.codePointAt(0)!));
      expect(missing.join("")).toBe("");
    });
  }
});
