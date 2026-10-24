import { describe, expect, it } from "vitest";
import { forceLayout, type GraphEdge, type GraphNode } from "@/lib/noteGraph";
import { graphLayoutHandlers } from "@/workers/graphLayoutHandlers";
import { layoutGraph } from "@/workers/graphLayout";

const nodes: GraphNode[] = ["a", "b", "c", "d"].map((id) => ({ id, title: id.toUpperCase(), degree: 1 }));
const edges: GraphEdge[] = [{ a: "a", b: "b" }, { a: "b", b: "c" }, { a: "c", b: "d" }];

describe("układ grafu poza wątkiem UI", () => {
  it("metoda Workera zwraca te same współrzędne co układ w wątku", () => {
    const entries = graphLayoutHandlers.layout(nodes, edges, 1000, 620);
    expect(new Map(entries)).toEqual(forceLayout(nodes, edges, 1000, 620));
  });

  it("bez Workera (jsdom) layoutGraph liczy w wątku i daje pełny układ", async () => {
    const pos = await layoutGraph(nodes, edges, 1000, 620);
    expect([...pos.keys()].sort()).toEqual(["a", "b", "c", "d"]);
    expect(pos).toEqual(forceLayout(nodes, edges, 1000, 620));
  });
});
