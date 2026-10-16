import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("wklejenie HTML w kompozytorze zamienia formatowanie na Markdown w miejscu kursora", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  const body = page.getByPlaceholder("Treść notatki...");
  await body.fill("Przed ");
  const html = "<h2>Plan</h2><p>To <strong>ważne</strong> i <em>pilne</em>.</p><ul><li>mleko</li></ul>";
  await body.evaluate((el, h) => {
    const dt = new DataTransfer();
    dt.setData("text/html", h);
    dt.setData("text/plain", "Plan\nTo ważne i pilne.\nmleko");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, html);
  await expect(body).toHaveValue(/^Przed ## Plan\n\nTo \*\*ważne\*\* i \*pilne\*\.\n\n- mleko$/);
});
