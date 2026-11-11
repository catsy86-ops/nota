import { describe, expect, it } from "vitest";

// Każdy plik, który woła `document.startViewTransition`, musi przejść przez strażnik WebKit z `viewTransition.ts`
// (w WebKit przejścia kończyły się awarią renderera). Test czyta źródła, więc nowy bezpośredni użytek od razu go zawiedzie.
const sources = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

describe("View Transitions tylko przez strażnik WebKit", () => {
  it("pliki używające startViewTransition importują canViewTransition albo withViewTransition", () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.endsWith("/src/lib/viewTransition.ts"))
      .filter(([, src]) => /startViewTransition/.test(src))
      .filter(([, src]) => !/(canViewTransition|withViewTransition)/.test(src))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
