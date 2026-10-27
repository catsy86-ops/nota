import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";

// Cele dotyku (plan UI 3.11, WCAG 2.5.5/2.5.8): każdy widoczny element interaktywny na telefonie
// ma obszar trafienia co najmniej 44×44 px. Obszar to pudełko elementu plus rozszerzenie `::after`
// (`coarse:after:*`, `.tap-target`), bo tak pracują przyciski ikon i pigułki w aplikacji.
// Zapis raportu: zmienna TOUCH_AUDIT_OUT (plik JSON), opcjonalnie.

const PATHS = ["/", "/przypomnienia", "/kalendarz", "/grafik", "/praca"];
const SELECTOR = "button, a[href], input, select, textarea, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [role=radio]";
const MIN = 44;

test("cele dotyku na telefonie są co najmniej 44 px @mobile", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  const report: Array<{ path: string; w: number; h: number; hitW: number; hitH: number; label: string; tag: string }> = [];

  for (const path of PATHS) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const items = await page.$$eval(SELECTOR, (els) =>
      els
        .map((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const visible = r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
          // Rozszerzenie `::after` liczy się do obszaru trafienia tylko wtedy, gdy ma zawartość i pozycję.
          const after = getComputedStyle(el, "::after");
          const afterOn = after.content !== "none" && after.content !== "normal" && after.position === "absolute";
          const aw = afterOn ? parseFloat(after.width) || 0 : 0;
          const ah = afterOn ? parseFloat(after.height) || 0 : 0;
          return {
            visible,
            w: Math.round(r.width),
            h: Math.round(r.height),
            hitW: Math.round(Math.max(r.width, aw)),
            hitH: Math.round(Math.max(r.height, ah)),
            label: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 60),
            tag: el.tagName.toLowerCase(),
          };
        })
        .filter((x) => x.visible)
    );
    for (const it of items) {
      if (it.hitW < MIN || it.hitH < MIN) report.push({ path, w: it.w, h: it.h, hitW: it.hitW, hitH: it.hitH, label: it.label, tag: it.tag });
    }
  }

  const out = process.env.TOUCH_AUDIT_OUT;
  if (out) writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  expect(report, "elementy poniżej 44×44 px (pudełko + ::after)").toEqual([]);
});
