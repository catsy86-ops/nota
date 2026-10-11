import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
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

test("heavy optional libraries stay out of the eager page load @smoke", async () => {
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
  expect(chunksMatching(eager, /ZodError/), "zod (noteSchema) only loads for import/backup").toEqual([]);
  expect(chunksMatching(eager, /transferControlToOffscreen/), "canvas-confetti loads on the first effect").toEqual([]);
  expect(chunksMatching(eager, /rdp-months/), "react-day-picker loads with the date picker").toEqual([]);
  expect(chunksMatching(eager, /Pattern length exceeds max of/), "fuse.js loads in idle time / on first search").toEqual([]);
  expect(chunksMatching(eager, /PERTAL²/), "study material (content.ts) loads with the Nauka view").toEqual([]);

  // And jsPDF must actually still be *somewhere* — otherwise this test would
  // also pass if PDF export had silently been dropped from the build.
  expect(chunksMatching(lazy, /jsPDF/), "jsPDF should be present in a lazily loaded chunk").not.toEqual([]);
});

test("PDF export lazily fetches its chunk and produces a file", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");

  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(`PDF ${Date.now()}`);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

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

// 3.7 Budżety: progi zapadkowe na poziomie z 2026-10-11 (z małym zapasem) — rośnięcie paczki,
// precache albo DOM wychodzi w teście, a nie dopiero na telefonie. Cele z roadmapy (wejściowy JS
// ≤200 KB, precache ≤1,5 MB, DOM ≤3 000) czekają na decyzje o precache i wirtualizacji; po każdym
// zejściu w dół obniż próg. Czasów (FAB, klawisz) tu nie ma — na współdzielonej maszynie CI skaczą.
const KB = 1024;
const BUDGET = {
  eagerJsGzip: 375 * KB, // 2026-10-11: 357 KB (index 214 + react/motion/radix/dnd)
  precacheBytes: 4.3 * KB * KB, // 2026-10-11: 3,85 MB, 72 pliki
  domPhone: 10_500, // 2026-10-11: 9 763 przy 300 notatkach (mozaika)
  domDesktop: 20_500, // 2026-10-11: 19 220 — akcje kafla w DOM dla najechania
};

test("budżet: wejściowy JS (gzip) @smoke", () => {
  const sizes = eagerChunks().map((f) => [f, gzipSync(readFileSync(path.join(assetsDir, f))).length] as const);
  const total = sizes.reduce((a, [, n]) => a + n, 0);
  expect(total, `wejściowy JS ${Math.round(total / KB)} KB gzip: ${sizes.map(([f, n]) => `${f} ${Math.round(n / KB)}`).join(", ")}`).toBeLessThanOrEqual(BUDGET.eagerJsGzip);
});

test("budżet: precache service workera @smoke", () => {
  const sw = readFileSync(path.join(distDir, "sw.js"), "utf8");
  const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
  expect(urls.length, "sw.js powinien mieć listę precache").toBeGreaterThan(10);
  const total = urls.reduce((a, u) => a + statSync(path.join(distDir, u)).size, 0);
  expect(total, `precache ${(total / KB / KB).toFixed(2)} MB (${urls.length} plików)`).toBeLessThanOrEqual(BUDGET.precacheBytes);
});

const NOW = Date.now();
const NOTES_300 = Array.from({ length: 300 }, (_, i) => ({
  id: `b${i}`, title: `Notatka ${i}`, content: Array.from({ length: 1 + (i % 4) }, (_, k) => `Linia ${k} notatki ${i}`).join("\n\n"),
  color: "default", pinned: i < 3, archived: false, trashed: false, trashedAt: null, labels: i % 3 ? ["praca"] : [], reminder: null,
  priority: "none", images: [], checklist: [], folderId: null, order: i, createdAt: NOW - i * 1000, updatedAt: NOW - i * 1000,
}));

for (const [name, opts, limit] of [
  ["telefon", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, BUDGET.domPhone],
  ["komputer", { viewport: { width: 1440, height: 900 } }, BUDGET.domDesktop],
] as const) {
  test(`budżet: DOM przy 300 notatkach — ${name}`, async ({ browser }) => {
    const context = await browser.newContext(opts);
    const page = await context.newPage();
    await page.addInitScript((notes) => {
      localStorage.setItem("kaczy.tour.seen.v1", "1");
      localStorage.setItem("kaczy-notes-data", JSON.stringify(notes));
    }, NOTES_300);
    await page.goto("/");
    // Render progresywny — liczymy po dojściu wszystkich kafli.
    await expect(page.locator("[data-note-id-wrap]")).toHaveCount(300, { timeout: 30_000 });
    const nodes = await page.evaluate(() => document.getElementsByTagName("*").length);
    expect(nodes, `${nodes} węzłów DOM`).toBeLessThanOrEqual(limit);
    await context.close();
  });
}
