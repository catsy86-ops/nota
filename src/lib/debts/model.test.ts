import { describe, expect, it } from "vitest";
import { balances, cleanDebt, formatAmount, knownPeople, parseAmount, personKey, repaidShare, runningBalances, totals, type DebtEntry, type DebtKind } from "./model";

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
