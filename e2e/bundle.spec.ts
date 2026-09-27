import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, "..", "dist");
const assetsDir = path.join(distDir, "assets");

/**
 * Walks the *static* ES-module import graph of the built app, starting from the
 * entry <script type="module"> plus everything index.html asks the browser to
 * <link rel="modulepreload">. Dynamic `import("./x.js")` edges are deliberately
 * not followed — those are the lazy chunks, fetched only when a feature is used.
 */
function eagerChunks(): string[] {
  const html = readFileSync(path.join(distDir, "index.html"), "utf8");
  const roots = [...html.matchAll(/(?:src|href)="\/assets\/([A-Za-z0-9._-]+\.js)"/g)].map((m) => m[1]);
  expect(roots.length, "built index.html should reference at least the entry chunk").toBeGreaterThan(0);

  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = readFileSync(path.join(assetsDir, file), "utf8");
    // Static edges only: `from"./chunk.js"` / `import"./chunk.js"`.
    for (const m of code.matchAll(/(?:from|import)"\.\/([A-Za-z0-9._-]+\.js)"/g)) queue.push(m[1]);
  }
  return [...seen];
}

/** Names the chunks whose code matches `marker`, so a failure points at a file
 *  instead of dumping half a megabyte of minified bundle into the report. */
function chunksMatching(files: string[], marker: RegExp): string[] {
  return files.filter((f) => marker.test(readFileSync(path.join(assetsDir, f), "utf8")));
}

test("heavy optional libraries stay out of the eager page load", async () => {
  const eager = eagerChunks();
  const allChunks = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
  const lazy = allChunks.filter((f) => !eager.includes(f));

  // Regression guard: jsPDF (~390 KB) used to be dragged into the eager graph
  // by a manualChunks entry — the main chunk statically imported the jspdf
  // chunk just to reach the 1 KB __vitePreload helper that had been placed
  // there, so every visitor downloaded and executed all of jsPDF on load.
  expect(chunksMatching(eager, /jsPDF/), "jsPDF must only arrive through the dynamic import in exportPdf.ts").toEqual([]);
  // Same shape of bug for the other lazily-used heavyweights.
  expect(chunksMatching(eager, /html2canvas/), "html2canvas must stay lazy").toEqual([]);
  expect(chunksMatching(eager, /recharts/i), "recharts (StatsDialog) must stay lazy").toEqual([]);

  // And jsPDF must actually still be *somewhere* — otherwise this test would
  // also pass if PDF export had silently been dropped from the build.
  expect(chunksMatching(lazy, /jsPDF/), "jsPDF should be present in a lazily loaded chunk").not.toEqual([]);
});

test("PDF export lazily fetches its chunk and produces a file", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");

  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(`PDF ${Date.now()}`);
  await page.getByRole("button", { name: "Zamknij" }).click();

  const jsRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/assets/") && r.url().endsWith(".js")) jsRequests.push(r.url());
  });

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Import / Eksport" }).click();
  await page.getByRole("menuitem", { name: "Eksportuj jako PDF" }).click();

  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  // The click — not the page load — is what pulled the PDF code down.
  expect(jsRequests.length, "clicking export should fetch at least one new chunk").toBeGreaterThan(0);
});
