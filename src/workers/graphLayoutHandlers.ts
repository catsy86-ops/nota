import { forceLayout, type GraphEdge, type GraphNode, type Point } from "@/lib/noteGraph";

/**
 * Metody Workera układu grafu. Osobno od pliku Workera, żeby dały się testować w jsdom.
 * Wynik to pary `[id, punkt]`, bo tak `Map` przechodzi przez `postMessage` bez dziwactw.
 */
export const graphLayoutHandlers = {
  layout: (nodes: GraphNode[], edges: GraphEdge[], w: number, h: number): [string, Point][] =>
    [...forceLayout(nodes, edges, w, h)],
};

export type GraphLayoutHandlers = typeof graphLayoutHandlers;
