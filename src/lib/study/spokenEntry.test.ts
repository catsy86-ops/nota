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
      fittings: [], text: "trójniki rozsunięte trzydzieści centymetrów", structured: false,
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
