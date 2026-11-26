import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYMeasures } from "./yMeasures";

describe("createYMeasures (C3.4)", () => {
  it("dwa telefony mierzą tego samego dnia różne partie — po scaleniu obie", () => {
    const a = new Y.Doc(), b = new Y.Doc();
    createYMeasures(a).set({ day: "2026-11-20", part: "pas", cm: 90, created: 1 });
    createYMeasures(b).set({ day: "2026-11-20", part: "udo", cm: 58, created: 2 });
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    expect(createYMeasures(a).get().map((m) => m.part)).toEqual(["pas", "udo"]);
  });

  it("ponowny pomiar nadpisuje; usunięcie i „Cofnij”; scalenie kopii — nowszy wygrywa, starszy nie nadpisuje", () => {
    const y = createYMeasures(new Y.Doc());
    y.set({ day: "2026-11-20", part: "pas", cm: 90, created: 5 });
    y.set({ day: "2026-11-20", part: "pas", cm: 89, created: 6 });
    expect(y.get()).toHaveLength(1);
    const gone = y.remove("pas", "2026-11-20")!;
    y.set(gone);
    expect(y.get()[0].cm).toBe(89);
    y.mergeDump([{ day: "2026-11-20", part: "pas", cm: 95, created: 1 }, { day: "2026-11-21", part: "ramie", cm: 35, created: 1 }]);
    expect(y.get().map((m) => [m.part, m.cm])).toEqual([["pas", 89], ["ramie", 35]]);
    y.mergeDump([{ day: "2026-11-20", part: "pas", cm: 88, created: 9 }]);
    expect(y.get()[0].cm).toBe(88);
  });
});
