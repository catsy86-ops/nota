import { describe, expect, it } from "vitest";
import { GRAPH_MAX_SCALE, GRAPH_VIEW_RESET, graphViewBox, panView, zoomView } from "./noteGraph";

describe("zoomView", () => {
  it("przybliża i ogranicza skalę do maksimum", () => {
    let v = zoomView(GRAPH_VIEW_RESET, 2);
    expect(v.scale).toBe(2);
    v = zoomView(v, 10);
    expect(v.scale).toBe(GRAPH_MAX_SCALE);
  });

  it("oddalenie do 1 wraca na środek płótna", () => {
    const v = zoomView({ scale: 2, cx: 0.2, cy: 0.9 }, 0.1);
    expect(v).toEqual(GRAPH_VIEW_RESET);
  });
});

describe("graphViewBox", () => {
  it("przy skali 1 pokazuje całe płótno", () => {
    expect(graphViewBox(GRAPH_VIEW_RESET, 600, 760)).toBe("0.0 0.0 600.0 760.0");
  });

  it("przy przybliżeniu w rogu nie wychodzi poza płótno", () => {
    expect(graphViewBox({ scale: 2, cx: 0, cy: 0 }, 600, 760)).toBe("0.0 0.0 300.0 380.0");
    expect(graphViewBox({ scale: 2, cx: 1, cy: 1 }, 600, 760)).toBe("300.0 380.0 300.0 380.0");
  });
});

describe("panView", () => {
  it("przy skali 1 nic się nie rusza", () => {
    expect(panView(GRAPH_VIEW_RESET, 0.3, 0.3)).toEqual(GRAPH_VIEW_RESET);
  });

  it("przesuwa środek, ale nie wychodzi poza płótno", () => {
    expect(panView({ scale: 2, cx: 0.5, cy: 0.5 }, 0.1, 0)).toEqual({ scale: 2, cx: 0.6, cy: 0.5 });
    expect(panView({ scale: 2, cx: 0.5, cy: 0.5 }, 0.9, -0.9)).toEqual({ scale: 2, cx: 0.75, cy: 0.25 });
  });

  it("po dojściu do krawędzi okno nadal leży w płótnie i wraca od razu", () => {
    const edge = panView({ scale: 2, cx: 0.5, cy: 0.5 }, 5, 0);
    expect(graphViewBox(edge, 600, 760)).toBe("300.0 190.0 300.0 380.0");
    const back = panView(edge, -0.1, 0);
    expect(back.cx).toBeCloseTo(0.65);
  });
});
