import { describe, expect, it } from "vitest";
import { parseSpokenEntry } from "./spokenEntry";
import { FITTING_SUGGESTIONS } from "./fittings";

const ctx = { sites: ["Lipowa 5", "Polna 2", "Dom Kowalski", "Dom Nowaków"], fittings: [...FITTING_SUGGESTIONS] };

describe("parseSpokenEntry — cały wpis z jednej wypowiedzi", () => {
  it("bez przecinków: budowa z pierwszego słowa przed rodzajem, rodzaj, tekst i kształtka na końcu", () => {
    expect(parseSpokenEntry("lipowa problem przeciek przy trójniku kolano 16 cztery sztuki", ctx)).toEqual({
      site: "Lipowa 5",
      kind: "problem",
      text: "przeciek przy trójniku",
      fittings: [{ name: "Kolano 16", qty: 4 }],
      shortages: [],
      structured: true,
    });
  });

  it("z przecinkami i pełną nazwą budowy (liczba słownie)", () => {
    const r = parseSpokenEntry("Lipowa pięć, zrobione, podejścia w łazience, trójnik 16 dwa i złączka 20 trzy sztuki", ctx);
    expect(r.site).toBe("Lipowa 5");
    expect(r.kind).toBe("ok");
    expect(r.text).toBe("podejścia w łazience");
    expect(r.fittings).toEqual([{ name: "Trójnik 16", qty: 2 }, { name: "Złączka 20", qty: 3 }]);
  });

  it("zwykłe zdanie zostaje tekstem dokładnie tak, jak padło", () => {
    expect(parseSpokenEntry("trójniki rozsunięte trzydzieści centymetrów", ctx)).toEqual({
      fittings: [], text: "trójniki rozsunięte trzydzieści centymetrów", shortages: [], structured: false,
    });
    expect(parseSpokenEntry("Wymieniłem kolano przy pionie", ctx).structured).toBe(false);
  });

  it("pierwsze słowo budowy bez przecinka i bez rodzaju za nim — to nie budowa", () => {
    // „polna” mogłoby być zwykłym słowem; budowa tylko z pełnej nazwy albo przed przecinkiem / rodzajem.
    expect(parseSpokenEntry("polna droga zalana", ctx).structured).toBe(false);
    expect(parseSpokenEntry("polna, droga zalana", ctx).site).toBe("Polna 2");
  });

  it("niejednoznaczne pierwsze słowo („dom”) wymaga pełnej nazwy", () => {
    expect(parseSpokenEntry("dom, przeciek", ctx).site).toBeUndefined();
    expect(parseSpokenEntry("dom kowalski usterka zawór cieknie", ctx)).toMatchObject({ site: "Dom Kowalski", kind: "problem", text: "zawór cieknie" });
  });

  it("słowo „budowa” przed nazwą i rodzaj bez budowy", () => {
    expect(parseSpokenEntry("budowa Polna 2 notatka inwestor chce zmian", ctx)).toMatchObject({ site: "Polna 2", kind: "note", text: "inwestor chce zmian" });
    expect(parseSpokenEntry("problem brak wody na piętrze", ctx)).toMatchObject({ kind: "problem", text: "brak wody na piętrze" });
    expect(parseSpokenEntry("problem brak wody na piętrze", ctx).site).toBeUndefined();
  });

  it("zapowiedź „kształtki” i spójnik przed kształtką nie zostają w tekście; znana nazwa wielowyrazowa", () => {
    const r = parseSpokenEntry("zrobione biały montaż kształtki kolano naścienne 16 dwie sztuki", ctx);
    expect(r.text).toBe("biały montaż");
    expect(r.fittings).toEqual([{ name: "Kolano naścienne 16", qty: 2 }]);
  });

  it("redukcja „20 na 16” jako wymiar", () => {
    expect(parseSpokenEntry("redukcja dwadzieścia na szesnaście dwie sztuki", ctx).fittings).toEqual([{ name: "Redukcja 20/16", qty: 2 }]);
  });
});

describe("parseSpokenEntry — braki materiału głosem", () => {
  it("„brakuje” po budowie: pozycje z ilością, pierwsze słowo z dopełniacza do mianownika, reszta jak padła", () => {
    expect(parseSpokenEntry("lipowa brakuje kleju do PCV i rury PEX 16 pięćdziesiąt metrów", ctx)).toEqual({
      site: "Lipowa 5",
      fittings: [],
      text: "",
      shortages: [{ text: "Klej do PCV", qty: "" }, { text: "Rura PEX 16", qty: "50 m" }],
      structured: true,
    });
  });

  it("„do zamówienia” bez budowy; jednostki inne niż m/szt. zostają słowem", () => {
    expect(parseSpokenEntry("do zamówienia: klej, otulina 9 mm dwa worki, rura 20 3 sztuki", ctx).shortages).toEqual([
      { text: "Klej", qty: "" },
      { text: "Otulina 9 mm", qty: "2 worki" },
      { text: "Rura 20", qty: "3 szt." },
    ]);
  });

  it("samo „brakuje” na początku zwykłego zdania z budową z przecinkiem", () => {
    const r = parseSpokenEntry("Polna, brakuje: syfon", ctx);
    expect(r.site).toBe("Polna 2");
    expect(r.shortages).toEqual([{ text: "Syfon", qty: "" }]);
  });

  it("po „do zamówienia” mianownik zostaje („rury” to liczba mnoga), nieznane słowo bez zmian", () => {
    expect(parseSpokenEntry("do zamówienia rury PEX 16", ctx).shortages).toEqual([{ text: "Rury PEX 16", qty: "" }]);
    expect(parseSpokenEntry("brakuje rotopiany", ctx).shortages).toEqual([{ text: "Rotopiany", qty: "" }]);
  });

  it("„brak” (nie „brakuje”) to zwykły problem w tekście, nie braki", () => {
    const r = parseSpokenEntry("problem brak wody na piętrze", ctx);
    expect(r.shortages).toEqual([]);
    expect(r.text).toBe("brak wody na piętrze");
  });
});

describe("parseSpokenEntry — etap głosem", () => {
  it("„etap … zrobiony” po budowie: nazwa etapu, rodzaj „zrobione”, dalej zwykły wpis", () => {
    expect(parseSpokenEntry("lipowa etap próba szczelności zrobiony ciśnienie trzymało", ctx)).toEqual({
      site: "Lipowa 5", kind: "ok", stage: "próba szczelności", fittings: [], text: "ciśnienie trzymało", shortages: [], structured: true,
    });
  });

  it("bez słowa końca — do przecinka; rodzaj z wypowiedzi zostaje", () => {
    const r = parseSpokenEntry("Polna, problem, etap biały montaż, brak baterii", ctx);
    expect(r.kind).toBe("problem");
    expect(r.stage).toBe("biały montaż");
    expect(r.text).toBe("brak baterii");
  });

  it("samo słowo „etap” bez nazwy to zwykły tekst", () => {
    expect(parseSpokenEntry("etap", ctx).structured).toBe(false);
  });
});
