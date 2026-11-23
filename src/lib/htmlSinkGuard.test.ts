import { describe, expect, it } from "vitest";

// S0.2: ujścia HTML to droga od złośliwej treści do XSS. Od S1.6 w `src/` nie ma żadnego (Mermaid idzie przez `<img src=blob:>`); nowe wymaga wpisu tutaj
// i przeglądu (docs/model-zagrozen.md, §„Ujścia HTML”). Test czyta źródła, więc nowe ujście bez wpisu od razu go zawiedzie.
const sources = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const SINKS = /dangerouslySetInnerHTML|\.innerHTML\b|\.outerHTML\b|\bsrcdoc\b|document\.write\b|insertAdjacentHTML|createContextualFragment/;

/** Dozwolone ujścia: plik → powód. */
const ALLOWED: Record<string, string> = {};

// Komentarze nie są ujściem — wycinamy je, żeby opis w kodzie nie wywoływał fałszywego alarmu.
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("ujścia HTML (S0.2)", () => {
  const offenders = Object.entries(sources)
    .filter(([path]) => !/\.test\.tsx?$/.test(path))
    .filter(([, src]) => SINKS.test(stripComments(src)))
    .map(([path]) => path)
    .sort();

  it("tylko pliki z listy dozwolonych używają ujścia HTML", () => {
    expect(offenders.filter((p) => !(p in ALLOWED))).toEqual([]);
  });

  it("lista dozwolonych nie zawiera martwych wpisów", () => {
    expect(Object.keys(ALLOWED).filter((p) => !offenders.includes(p))).toEqual([]);
  });
});
