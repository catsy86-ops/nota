// Profil procesora dla jednej akcji w Pracy (plan B0.4, Faza 5): które funkcje zjadają czas na emulowanym telefonie.
// Użycie: node scripts/profile-praca.mjs <seed.json> <akcja: karta|dziennik|szukaj> [adres] [dławienie=4]
import { readFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const [seedFile, action = "karta", base = "http://127.0.0.1:4174", throttleArg = "4"] = process.argv.slice(2);
const dump = JSON.parse(JSON.parse(readFileSync(seedFile, "utf8")).study);
const legacy = JSON.stringify({ site: dump.journal.at(-1)?.site ?? "", journal: dump.journal });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
const page = await context.newPage();
await page.addInitScript((blob) => {
  localStorage.setItem("kaczy.tour.seen.v1", "1");
  localStorage.setItem("kaczy.study.tab.v1", "journal");
  if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("kaczy.study.v1", blob); }
}, legacy);
await page.goto(`${base}/praca`);
await page.locator("[data-journal-entry]").first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(1500);
const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(throttleArg) });
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
if (action === "karta") {
  await page.getByTestId("study-journal").getByRole("button", { name: /: karta budowy$/ }).first().click();
  await page.getByTestId("site-card").waitFor();
} else if (action === "dziennik") {
  await page.getByRole("tab", { name: "Budowa", exact: true }).first().click();
  await page.waitForTimeout(600);
  await cdp.send("Profiler.stop"); await cdp.send("Profiler.start");
  await page.getByRole("tab", { name: "Dziennik", exact: true }).first().click();
  await page.locator("[data-journal-entry]").first().waitFor();
} else if (action === "szukaj") {
  await page.keyboard.press("Control+k");
  await page.locator("[cmdk-input]").waitFor({ timeout: 20_000 });
  await page.locator("[cmdk-input]").fill("zawór");
  await page.waitForFunction(() => document.querySelectorAll("[cmdk-item]").length > 0, null, { timeout: 20_000 }).catch(() => undefined);
}
await page.waitForTimeout(400);
const { profile } = await cdp.send("Profiler.stop");

// Czas własny (self) na funkcję i na plik.
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
profile.samples.forEach((id, i) => { self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)); });
const fn = new Map(), file = new Map();
for (const [id, us] of self) {
  const n = byId.get(id); const c = n.callFrame;
  const f = c.url.split("/").pop()?.split("?")[0] || "(natywne)";
  const key = `${c.functionName || "(anonimowa)"} @ ${f}:${c.lineNumber + 1}:${c.columnNumber}`;
  fn.set(key, (fn.get(key) ?? 0) + us); file.set(f, (file.get(f) ?? 0) + us);
}
const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${Math.round(v / 1000).toString().padStart(6)} ms  ${k}`);
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log(`Akcja: ${action}; łączny czas próbek ${Math.round(total / 1000)} ms (dławienie ×${throttleArg})`);
console.log("\nPliki:\n" + top(file, 8).join("\n"));
console.log("\nFunkcje:\n" + top(fn, 18).join("\n"));
await browser.close();
