import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Pole treści notatki w obu trybach: `textarea` (flaga `cmEditor` wyłączona)
 * albo CodeMirror 6 (włączona — contentDOM ma rolę textbox i tę samą etykietę).
 * Testy edytora używają tego zamiast `getByPlaceholder("Treść notatki...")`, żeby
 * ten sam zestaw działał w obu trybach (projekt `chromium-cm` w playwright.config.ts).
 */
export function editorBody(scope: Page | Locator): Locator {
  return scope.locator('textarea[placeholder="Treść notatki..."], [role="textbox"][aria-label="Treść notatki"]');
}

/**
 * Tekst pola: `value` dla textarea, a dla CM linie `.cm-line` złączone `\n`
 * (bez podpowiedzi placeholdera, która też jest w DOM, gdy dokument jest pusty).
 */
export async function readEditorText(body: Locator): Promise<string> {
  return body.evaluate((el) => {
    if (el instanceof HTMLTextAreaElement) return el.value;
    const root = el.closest(".cm-editor") ? el : el.querySelector(".cm-content") ?? el;
    return Array.from(root.querySelectorAll(":scope > .cm-line"))
      .map((line) => {
        const clone = line.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(".cm-placeholder").forEach((n) => n.remove());
        // Pole zadania w podglądzie zastępuje `[ ]`/`[x]`; w tekście dokumentu znacznik zostaje.
        clone.querySelectorAll<HTMLInputElement>("input.cm-lp-task").forEach((box) => {
          box.replaceWith(box.checked ? "[x]" : "[ ]");
        });
        return clone.textContent ?? "";
      })
      .join("\n");
  });
}

/** Asercja tekstu pola z ponawianiem (jak `toHaveValue`, ale działa też na CM). */
export async function expectEditorText(body: Locator, expected: string | RegExp): Promise<void> {
  if (typeof expected === "string") {
    await expect.poll(() => readEditorText(body)).toBe(expected);
  } else {
    await expect.poll(() => readEditorText(body)).toMatch(expected);
  }
}
