import { describe, expect, it } from "vitest";
import { balances, cleanDebt, debtsCsv, debtSide, doubleSettle, foldName, personStatement, formatAmount, knownPeople, parseAmount, personKey, repaidShare, runningBalances, totals, type DebtEntry, type DebtKind } from "./model";

const e = (over: Partial<DebtEntry>): DebtEntry => ({
  id: "d-1", person: "Anna", kind: "lent", amount: 10000, at: "2026-10-10", note: "", created: 1, ...over,
});

describe("runningBalances", () => {
  it("liczy saldo po każdym wpisie, najnowszy pierwszy", () => {
    // Najstarszy: pożyczyłem 100, potem oddał 30, potem pożyczyłem 50 → po tym: 100, 70, 120.
    const entries = [
      e({ id: "c", kind: "lent", amount: 5000, at: "2026-10-12" }),
      e({ id: "b", kind: "repaid", amount: 3000, at: "2026-10-11" }),
      e({ id: "a", kind: "lent", amount: 10000, at: "2026-10-10" }),
    ];
    expect(runningBalances(entries)).toEqual([12000, 7000, 10000]);
  });

  it("zwraca pustą tablicę dla braku wpisów", () => {
    expect(runningBalances([])).toEqual([]);
  });
});

describe("parseAmount", () => {
  it("przyjmuje przecinek, kropkę i spacje tysięcy", () => {
    expect(parseAmount("1 234,5")).toBe(123450);
    expect(parseAmount("1234.50")).toBe(123450);
    expect(parseAmount("80")).toBe(8000);
    expect(parseAmount("0,05")).toBe(5);
  });

  it("odrzuca zero, litery, trzy miejsca po przecinku i ponad limit", () => {
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("12a")).toBeNull();
    expect(parseAmount("1,234")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("2000000")).toBeNull();
  });
});

describe("formatAmount", () => {
  it("formatuje grosze jako złote z dwoma miejscami", () => {
    expect(formatAmount(123450)).toMatch(/^1\s?234,50 zł$/);
    expect(formatAmount(5)).toBe("0,05 zł");
  });
});

describe("cleanDebt", () => {
  it("przepuszcza poprawny wpis i obcina zbyt długie pola", () => {
    const out = cleanDebt({ ...e({ note: "  x  " }), person: "  Jan   Kowalski " });
    expect(out?.person).toBe("Jan Kowalski");
    expect(out?.note).toBe("x");
  });

  it("odrzuca śmieci: zła kwota, zły dzień, zły rodzaj, pusta osoba", () => {
    expect(cleanDebt(e({ amount: -5 }))).toBeNull();
    expect(cleanDebt(e({ amount: 1.5 }))).toBeNull();
    expect(cleanDebt(e({ at: "10.10.2026" }))).toBeNull();
    expect(cleanDebt(e({ kind: "gift" as never }))).toBeNull();
    expect(cleanDebt(e({ person: "   " }))).toBeNull();
    expect(cleanDebt(null)).toBeNull();
  });
});

describe("balances", () => {
  it("liczy saldo: pożyczka dodaje, oddanie odejmuje", () => {
    const list = [
      e({ id: "1", amount: 10000, created: 1 }),
      e({ id: "2", kind: "repaid", amount: 4000, at: "2026-10-12", created: 2 }),
    ];
    const [p] = balances(list);
    expect(p.balance).toBe(6000);
    expect(p.entries.map((x) => x.id)).toEqual(["2", "1"]);
  });

  it("grupuje bez względu na wielkość liter i sortuje: nam winni, my winni, rozliczeni", () => {
    const list = [
      e({ id: "a", person: "Anna", amount: 5000 }),
      e({ id: "b", person: "anna", kind: "repaid", amount: 5000 }),
      e({ id: "c", person: "Bartek", amount: 2000 }),
      e({ id: "d", person: "Celina", kind: "repaid", amount: 900 }),
    ];
    const people = balances(list);
    expect(people.map((p) => p.name)).toEqual(["Bartek", "Celina", "Anna"]);
    expect(people[2].balance).toBe(0);
    expect(people[1].balance).toBe(-900);
    expect(totals(people)).toEqual({ owedToMe: 2000, iOwe: 900 });
  });
});

describe("knownPeople", () => {
  it("zwraca nazwę z najnowszego wpisu, bez powtórek", () => {
    const names = knownPeople([e({ id: "1", person: "anna", created: 1 }), e({ id: "2", person: "Anna", created: 2 }), e({ id: "3", person: "Ola", created: 0 })]);
    expect(names).toEqual(["Anna", "Ola"]);
    expect(personKey("  ANNA ")).toBe("anna");
  });
});

describe("cztery rodzaje wpisu i znak salda", () => {
  it("pożyczka od kogoś zmniejsza saldo, a jego zwrot je zwiększa", () => {
    const [p] = balances([
      e({ id: "1", kind: "lent", amount: 10000, created: 1 }),
      e({ id: "2", kind: "borrowed", amount: 4000, at: "2026-10-12", created: 2 }),
      e({ id: "3", kind: "returned", amount: 1000, at: "2026-10-13", created: 3 }),
    ]);
    expect(p.balance).toBe(10000 - 4000 + 1000);
  });

  it("saldo ujemne: my jesteśmy winni i mamy to w podsumowaniu", () => {
    const people = balances([e({ id: "1", kind: "borrowed", amount: 2500 })]);
    expect(people[0].balance).toBe(-2500);
    expect(totals(people)).toEqual({ owedToMe: 0, iOwe: 2500 });
  });

  it("cleanDebt przepuszcza wszystkie cztery rodzaje, a obce odrzuca", () => {
    for (const kind of ["lent", "repaid", "borrowed", "returned"]) expect(cleanDebt(e({ kind: kind as never }))?.kind).toBe(kind);
    expect(cleanDebt(e({ kind: "gift" as never }))).toBeNull();
  });
});

describe("repaidShare — pasek spłaty z obu stron", () => {
  const e = (kind: DebtKind, amount: number) => ({ id: `${kind}${amount}`, person: "Ania", kind, amount, at: "2026-10-01", note: "", created: 1 }) as DebtEntry;
  it("pożyczka od nas: liczy spłaty", () => {
    expect(repaidShare([e("lent", 1000), e("repaid", 250)])).toBe(25);
  });
  it("pożyczka od niej: pokazuje też nasze spłaty (wcześniej pasek był pusty)", () => {
    expect(repaidShare([e("borrowed", 1000), e("returned", 400)])).toBe(40);
  });
  it("99,6% nie jest 100%; zero salda to 100%", () => {
    expect(repaidShare([e("lent", 10000), e("repaid", 9960)])).toBe(99);
    expect(repaidShare([e("lent", 1000), e("repaid", 1000)])).toBe(100);
  });
});

describe("strona salda i podwójne rozliczenie (1.3, 1.6)", () => {
  it("debtSide: przy samym „Pożyczyłem od” strona winna to nasz dług", () => {
    expect(debtSide([e({ id: "a", kind: "borrowed", amount: 50_000 }), e({ id: "b", kind: "returned", amount: 20_000 })]))
      .toEqual({ side: 50_000, done: 20_000, balance: -30_000 });
    expect(repaidShare([e({ id: "a", kind: "borrowed", amount: 50_000 }), e({ id: "b", kind: "returned", amount: 20_000 })])).toBe(40);
    expect(debtSide([e({ id: "a", kind: "lent", amount: 10_000 })])).toEqual({ side: 10_000, done: 0, balance: 10_000 });
  });

  it("cleanDebt zachowuje tylko settle: true", () => {
    expect(cleanDebt({ ...e({ id: "a" }), settle: true })?.settle).toBe(true);
    expect(cleanDebt({ ...e({ id: "a" }), settle: "tak" })).not.toHaveProperty("settle");
  });

  it("doubleSettle: dwa „całość” w minutę, saldo po drugiej stronie → nowszy; inaczej null", () => {
    const lent = e({ id: "l", kind: "lent", amount: 10_000, created: 1 });
    const s1 = e({ id: "s1", kind: "repaid", amount: 10_000, created: 1_000, settle: true });
    const s2 = e({ id: "s2", kind: "repaid", amount: 10_000, created: 30_000, settle: true });
    expect(doubleSettle([lent, s1, s2])?.id).toBe("s2");
    expect(doubleSettle([lent, s1])).toBeNull();
    expect(doubleSettle([lent, s1, { ...s2, created: 200_000 }])).toBeNull();
    expect(doubleSettle([lent, s1, { ...s2, settle: undefined }])).toBeNull();
  });
});

describe("foldName (2.5)", () => {
  it("małe litery bez polskich znaków", () => {
    expect(foldName("  Łukasz  Żółć ")).toBe("lukasz zolc");
    expect(foldName("ŚWIĘTY")).toBe("swiety");
  });
});

describe("wiadomość i CSV (3.2, 3.4)", () => {
  const list = [
    e({ id: "a", person: "Ania", kind: "lent", amount: 10_000, at: "2026-10-01", created: 1, note: "=SUMA(A1)" }),
    e({ id: "b", person: "Ania", kind: "repaid", amount: 2_550, at: "2026-10-05", created: 2 }),
    e({ id: "c", person: "Marek", kind: "borrowed", amount: 4_000, at: "2026-10-03", created: 3, note: "obiad; kino" }),
  ];

  it("wiadomość: saldo i wpisy od najnowszego", () => {
    const ania = balances(list).find((p) => p.name === "Ania")!;
    const lines = personStatement(ania).split(String.fromCharCode(10));
    expect(lines[0]).toBe("Ania — rozliczenie");
    expect(lines[1]).toBe("Do oddania: 74,50 zł");
    expect(lines[3]).toBe("05.10.2026 · Oddał mi · 25,50 zł");
    expect(lines[4]).toBe("01.10.2026 · Pożyczyłem · 100,00 zł · =SUMA(A1)");
  });

  it("CSV: BOM, średnik, od najstarszego, saldo osoby ze znakiem, bez formuł", () => {
    const csv = debtsCsv(list);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const rows = csv.slice(1).split(String.fromCharCode(13, 10));
    expect(rows[0]).toBe("Data;Osoba;Rodzaj;Kwota [zł];Za co;Saldo osoby [zł] (+ nam winna)");
    expect(rows[1]).toBe("2026-10-01;Ania;Pożyczyłem;100,00;'=SUMA(A1);74,50");
    expect(rows[2]).toBe('2026-10-03;Marek;Pożyczyłem od;40,00;"obiad; kino";-40,00');
    expect(rows[3]).toBe("2026-10-05;Ania;Oddał mi;25,50;;74,50");
  });
});
