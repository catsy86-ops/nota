import { describe, expect, it } from "vitest";
import { CLOSED_PANELS, entrySections, panelsReducer } from "./entryPanels";

const empty = { topic: "", test: null, fittings: [] };

describe("panelsReducer", () => {
  it("przełącza i ustawia panel; bez zmiany zwraca ten sam obiekt", () => {
    const a = panelsReducer(CLOSED_PANELS, { type: "toggle", panel: "fittings" });
    expect(a.fittings).toBe(true);
    expect(panelsReducer(a, { type: "toggle", panel: "fittings" }).fittings).toBe(false);
    expect(panelsReducer(a, { type: "set", panel: "fittings", open: true })).toBe(a);
    expect(panelsReducer(a, { type: "set", panel: "topic", open: true })).toMatchObject({ fittings: true, topic: true, pipes: false });
  });
});

describe("entrySections", () => {
  it("pusty wpis: wszystko schowane, nic wymuszone", () => {
    const s = entrySections(CLOSED_PANELS, empty);
    expect(Object.values(s).every((x) => !x.visible && !x.forced)).toBe(true);
  });

  it("dane wymuszają sekcję mimo zamkniętego panelu", () => {
    const s = entrySections(CLOSED_PANELS, { ...empty, fittings: [{ name: "Kolano 16", qty: 1 }], level: 0, barcode: "590", summary: "x" });
    expect(s.fittings).toEqual({ visible: true, forced: true });
    expect(s.level.visible && s.barcode.visible && s.ai.visible).toBe(true);
    expect(s.pipes.visible).toBe(false);
  });

  it("temat próby wymusza sekcję próby; ręcznie otwarta sekcja nie jest wymuszona", () => {
    expect(entrySections(CLOSED_PANELS, { ...empty, topic: "proba-wody" }).test).toEqual({ visible: true, forced: true });
    expect(entrySections({ ...CLOSED_PANELS, pipes: true }, empty).pipes).toEqual({ visible: true, forced: false });
  });
});
