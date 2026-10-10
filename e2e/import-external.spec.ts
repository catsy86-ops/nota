import { test, expect, type Page } from "@playwright/test";
import { buildZip } from "../src/lib/import/__fixtures__/zipBuilder";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function openImportDialog(page: Page) {
  await page.getByRole("button", { name: "Import / Eksport" }).click();
  await page.getByRole("menuitem", { name: "Z Google Keep / Markdown" }).click();
  const dialog = page.getByRole("dialog", { name: "Import z Google Keep / Markdown" });
  await expect(dialog).toBeVisible();
  return dialog;
}

const keepNote = (title: string) => JSON.stringify({
  color: "YELLOW", isTrashed: false, isPinned: false, isArchived: false,
  textContent: "Treść z Keep", title,
  userEditedTimestampUsec: 1616000000000000, createdTimestampUsec: 1615982591000000,
  labels: [{ name: "KeepEtykieta" }],
});

test("import: Keep JSON i Markdown z frontmatterem — podsumowanie, zapis i Cofnij", async ({ page }) => {
  const stamp = Date.now();
  const keepTitle = `Keep ${stamp}`;
  const mdTitle = `Obsidian ${stamp}`;
  const dialog = await openImportDialog(page);

  await dialog.getByTestId("import-files-input").setInputFiles([
    { name: "Keep1.json", mimeType: "application/json", buffer: Buffer.from(keepNote(keepTitle)) },
    { name: "Labels.txt", mimeType: "text/plain", buffer: Buffer.from("KeepEtykieta") },
    {
      name: `${mdTitle}.md`, mimeType: "text/markdown",
      buffer: Buffer.from("---\ntags: [import-md, \"#drugi\"]\ncreated: 2024-02-10\n---\nTreść z [[Innej notatki]]\n\n- [ ] pierwsze\n- [x] drugie\n"),
    },
    { name: "uszkodzony.json", mimeType: "application/json", buffer: Buffer.from("{ucięty") },
  ]);

  const summary = dialog.getByTestId("import-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Notatki");
  await expect(summary).toContainText("Etykiety");
  await expect(summary).toContainText("Uszkodzone");
  // Jeszcze nic nie zapisano.
  await expect(page.getByText(keepTitle)).toHaveCount(0);

  await dialog.getByRole("button", { name: "Importuj 2" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(keepTitle)).toBeVisible();
  await expect(page.getByText(mdTitle)).toBeVisible();
  await expect(page.getByText("Zaimportowano 2 notatki")).toBeVisible();

  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByText(keepTitle)).toHaveCount(0);
  await expect(page.getByText(mdTitle)).toHaveCount(0);
});

test("import: ZIP z Takeout z obrazem i ponowny import pomija duplikaty", async ({ page }) => {
  const title = `Zip ${Date.now()}`;
  // Najmniejszy poprawny PNG 1x1.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const note = JSON.parse(keepNote(title));
  note.attachments = [{ filePath: "foto.png", mimetype: "image/png" }];
  const zip = buildZip([
    { name: "Takeout/Keep/Nota.json", data: JSON.stringify(note) },
    { name: "Takeout/Keep/foto.png", data: png, method: 0 },
  ]);

  let dialog = await openImportDialog(page);
  await dialog.getByTestId("import-files-input").setInputFiles({ name: "takeout.zip", mimeType: "application/zip", buffer: zip });
  await expect(dialog.getByTestId("import-summary")).toContainText("Obrazy");
  await dialog.getByRole("button", { name: "Importuj 1" }).click();
  const card = page.locator("[data-note-id]").filter({ hasText: title });
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toHaveCount(1);

  // Drugi raz ta sama paczka: wszystko to duplikaty, nic do zaimportowania.
  dialog = await openImportDialog(page);
  await dialog.getByTestId("import-files-input").setInputFiles({ name: "takeout.zip", mimeType: "application/zip", buffer: zip });
  await expect(dialog.getByTestId("import-summary")).toContainText("Duplikaty");
  await expect(dialog.getByRole("button", { name: "Importuj 0" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Anuluj" }).click();
  await expect(dialog).toHaveCount(0);
});
