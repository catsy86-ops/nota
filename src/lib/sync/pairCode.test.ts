import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET, CODE_LENGTH_LONG, CODE_LENGTH_SHORT, checksumChars, codeFromPaste, codeKind, formatCode, generateCode,
  normalizeCode, parseCode,
} from "@/lib/sync/pairCode";

/** Wektor z `docs/plan-wymiana-kodu.md` §1.1 (policzony ręcznie). */
const BODY = "ABCDEFGHJKMNPQRSTUVWXYZ234";
const LONG = BODY + "ZG";
const SHORT = "ABCDEFGHJKMN";

describe("kod parowania — znaki kontrolne (S2.2)", () => {
  it("wektor testowy ze specyfikacji", () => {
    expect(checksumChars(BODY)).toBe("ZG");
    expect(parseCode(LONG)).toEqual({ code: LONG, kind: "long" });
  });

  it("każda pojedyncza podmiana znaku jest odrzucona", () => {
    for (let i = 0; i < CODE_LENGTH_LONG; i++) {
      for (const c of CODE_ALPHABET) {
        if (c === LONG[i]) continue;
        const bad = LONG.slice(0, i) + c + LONG.slice(i + 1);
        expect(parseCode(bad).error, `pozycja ${i} → ${c}`).toBe("checksum");
      }
    }
  });

  it("każda zamiana sąsiednich znaków miejscami jest odrzucona", () => {
    for (let i = 0; i < CODE_LENGTH_LONG - 1; i++) {
      if (LONG[i] === LONG[i + 1]) continue;
      const bad = LONG.slice(0, i) + LONG[i + 1] + LONG[i] + LONG.slice(i + 2);
      expect(parseCode(bad).error, `zamiana ${i}/${i + 1}`).toBe("checksum");
    }
  });

  it("długości 0–40 poza 12 i 28 są odrzucone; 12 to kod krótki", () => {
    for (let n = 0; n <= 40; n++) {
      const raw = "B".repeat(n);
      const r = parseCode(raw);
      if (n === CODE_LENGTH_SHORT) expect(r).toEqual({ code: raw, kind: "short" });
      else if (n === CODE_LENGTH_LONG) expect(r.error).toBe("checksum"); // same „B” nie dają poprawnej sumy (same „A” dają: obie sumy to 0)
      else expect(r.error, `długość ${n}`).toBe("length");
    }
  });

  it("znak spoza alfabetu to błąd, nie cichy skrót", () => {
    expect(parseCode("ABCDEFGHJKM0").error).toBe("chars");
    expect(parseCode(SHORT + ".").error).toBe("chars");
  });

  it("przyjmuje grupy, małe litery i cały link", () => {
    expect(parseCode(" abcd-efgh jkmn ")).toEqual({ code: SHORT, kind: "short" });
    expect(parseCode(`https://x.pl/app/#pair=${LONG.toLowerCase()}&v=3`)).toEqual({ code: LONG, kind: "long" });
    expect(parseCode(`https://x.pl/app/?pair=${SHORT}#n`)).toEqual({ code: SHORT, kind: "short" });
  });
});

describe("kod parowania — generator i pomocnicze", () => {
  it("generuje długi kod z poprawnymi znakami kontrolnymi, krótki na życzenie", () => {
    for (let i = 0; i < 30; i++) {
      const long = generateCode();
      expect(long).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{28}$/);
      expect(parseCode(long)).toEqual({ code: long, kind: "long" });
      expect(codeKind(long)).toBe("long");
    }
    const short = generateCode("short");
    expect(short).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
    expect(codeKind(short)).toBe("short");
  });

  it("codeFromPaste nie tnie już do 12 znaków; górna granica 28", () => {
    expect(codeFromPaste("abcd efgh-jkmn")).toBe(SHORT);
    expect(codeFromPaste(`https://x.pl/app/?pair=${SHORT}#n`)).toBe(SHORT);
    expect(codeFromPaste(" ABCD EFGH.")).toBe("ABCDEFGH");
    expect(codeFromPaste("ABCDEFGHJKMNPQRS")).toBe("ABCDEFGHJKMNPQRS");
    expect(codeFromPaste(LONG + "ABCD")).toBe(LONG);
    expect(codeFromPaste(`https://x.pl/#pair=${LONG}&v=3`)).toBe(LONG);
  });

  it("normalizuje i dzieli na grupy po 4 (28 znaków → 7 grup)", () => {
    expect(normalizeCode(" abcd-efgh jkmn ")).toBe(SHORT);
    expect(formatCode(SHORT)).toBe("ABCD EFGH JKMN");
    expect(formatCode(LONG).split(" ")).toHaveLength(7);
  });
});
