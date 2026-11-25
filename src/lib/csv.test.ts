import { describe, expect, it } from "vitest";
import { csvDocument, csvNumber, csvText } from "./csv";

describe("csv (C3.5)", () => {
  it("tekst: apostrof przed znakiem formuły, cudzysłowy przy ; \" i końcach linii, pusty bez apostrofu", () => {
    expect(csvText("=SUMA(A1)")).toBe("'=SUMA(A1)");
    expect(csvText("-5 kg")).toBe("'-5 kg");
    expect(csvText("@x")).toBe("'@x");
    expect(csvText("\tx")).toBe("'\tx");
    expect(csvText("obiad; kino")).toBe('"obiad; kino"');
    expect(csvText('a "b"')).toBe('"a ""b"""');
    expect(csvText("a\nb")).toBe('"a\nb"');
    expect(csvText("")).toBe("");
  });

  it("liczba: przecinek, bez apostrofu przy minusie, stałe miejsca, brak = puste", () => {
    expect(csvNumber(-12.5, 2)).toBe("-12,50");
    expect(csvNumber(72.4)).toBe("72,4");
    expect(csvNumber(undefined)).toBe("");
    expect(csvNumber(Number.NaN)).toBe("");
  });

  it("dokument: BOM, średnik, CRLF i CRLF na końcu", () => {
    expect(csvDocument([["a", "b"], ["1", "2"]])).toBe("﻿a;b\r\n1;2\r\n");
  });
});
