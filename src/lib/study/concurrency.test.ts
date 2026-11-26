import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYStudy, type JournalEntry } from "./yStudy";

/**
 * Z-11 (`docs/zlecenia-fable-2026-11-15.md`): Praca na dwóch telefonach bez łączności, potem wymiana w obie strony.
 * Punkt 5 (dowolna kolejność i powtórzenia dostarczania dają ten sam `dump()`) sprawdza zestaw zbieżności
 * (`convergence.prop.test.ts`); tu przypadki nazwane w zleceniu.
 */

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({ id: "w1", at: 1000, kind: "problem", topic: null, text: "cieknie", site: "Lipowa 5", checked: [], images: [], ...over });

/** Dwa telefony z tym samym stanem startowym; `sync` wymienia różnice w obie strony. */
function twoPhones(seed?: (y: ReturnType<typeof createYStudy>) => void) {
  const a = new Y.Doc(); a.clientID = 1;
  const b = new Y.Doc(); b.clientID = 2;
  const ya = createYStudy(a);
  const yb = createYStudy(b);
  if (seed) { seed(ya); Y.applyUpdate(b, Y.encodeStateAsUpdate(a)); }
  const sync = () => {
    const ab = Y.encodeStateAsUpdate(a, Y.encodeStateVector(b));
    const ba = Y.encodeStateAsUpdate(b, Y.encodeStateVector(a));
    Y.applyUpdate(b, ab);
    Y.applyUpdate(a, ba);
  };
  return { ya, yb, sync };
}

/** Odwołanie do zdjęcia ma kształt skrótu SHA-256 (`isImageRef`) — inne `cleanEntry` odrzuca. */
const ref = (c: string) => c.repeat(64);
const IMG_0 = ref("0"), IMG_A = ref("a"), IMG_B = ref("b");

const find = (y: ReturnType<typeof createYStudy>, id: string) => y.dump().journal.find((e) => e.id === id);

describe("Praca na dwóch telefonach (Z-11)", () => {
  it("1. oba telefony dodają zdjęcie do tego samego wpisu — po scaleniu są oba", () => {
    const { ya, yb, sync } = twoPhones((y) => y.addEntry(entry()));
    ya.updateEntry({ ...find(ya, "w1")!, images: [IMG_A] });
    yb.updateEntry({ ...find(yb, "w1")!, images: [IMG_B] });
    sync();
    expect([...find(ya, "w1")!.images].sort()).toEqual([IMG_A, IMG_B]);
    expect(find(yb, "w1")!.images).toEqual(find(ya, "w1")!.images);
  });

  it("2a. równoległe odhaczenie dwóch różnych punktów listy — oba odhaczone", () => {
    const { ya, yb, sync } = twoPhones((y) => y.addEntry(entry()));
    ya.updateEntry({ ...find(ya, "w1")!, checked: ["p1"] });
    yb.updateEntry({ ...find(yb, "w1")!, checked: ["p2"] });
    sync();
    expect([...find(ya, "w1")!.checked].sort()).toEqual(["p1", "p2"]);
    expect([...find(yb, "w1")!.checked].sort()).toEqual(["p1", "p2"]);
  });

  it("2b. odhaczenie punktu na A i zmiana tekstu tego wpisu na B — zostają obie zmiany", () => {
    const { ya, yb, sync } = twoPhones((y) => y.addEntry(entry()));
    ya.updateEntry({ ...find(ya, "w1")!, checked: ["p1"] });
    yb.updateEntry({ ...find(yb, "w1")!, text: "cieknie złączka 16" });
    sync();
    for (const y of [ya, yb]) expect(find(y, "w1")).toMatchObject({ checked: ["p1"], text: "cieknie złączka 16" });
  });

  it("3. usunięcie wpisu na A i dodanie do niego zdjęcia na B — wpisu nie ma, nie wraca w połowie", () => {
    const { ya, yb, sync } = twoPhones((y) => y.addEntry(entry({ images: [IMG_0] })));
    ya.removeEntry("w1");
    yb.updateEntry({ ...find(yb, "w1")!, images: [IMG_0, IMG_B] });
    sync();
    // Zmiana wewnątrz usuniętej mapy wpisu ginie razem z nią (§2 specyfikacji zbieżności). Odwołanie `IMG_B`
    // zostaje tylko w `imageStore` urządzenia B — sprząta je odśmiecanie obrazów po karencji (Z-6).
    expect(find(ya, "w1")).toBeUndefined();
    expect(find(yb, "w1")).toBeUndefined();
    expect(ya.dump().journal).toEqual(yb.dump().journal);
  });
});
