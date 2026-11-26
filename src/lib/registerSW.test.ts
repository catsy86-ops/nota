import { describe, expect, it } from "vitest";
import { resetAppFiles, UPDATE_CHECK_MS } from "./registerSW";
import { AUTO_UPDATE_IDLE_MS, shouldAutoApply, type UpdateMoment } from "./autoUpdate";

const m = (over: Partial<UpdateMoment> = {}): UpdateMoment => ({ auto: true, waiting: true, unsaved: false, hidden: false, idleMs: 0, ...over });

describe("shouldAutoApply — auto-aktualizacja", () => {
  it("podmienia wersję, gdy karta jest schowana, czeka wersja i nie ma niezapisanej pracy", () => {
    expect(shouldAutoApply(m({ hidden: true }))).toBe(true);
  });

  it("otwarta karta: dopiero po minucie bez aktywności", () => {
    expect(shouldAutoApply(m({ idleMs: AUTO_UPDATE_IDLE_MS - 1 }))).toBe(false);
    expect(shouldAutoApply(m({ idleMs: AUTO_UPDATE_IDLE_MS }))).toBe(true);
  });

  it("nie zgubi niezapisanej pracy", () => {
    expect(shouldAutoApply(m({ hidden: true, unsaved: true }))).toBe(false);
  });

  it("nic nie robi bez oczekującej wersji", () => {
    expect(shouldAutoApply(m({ hidden: true, waiting: false }))).toBe(false);
  });

  it("wyłączona auto-aktualizacja — nigdy sama, nawet po schowaniu karty", () => {
    expect(shouldAutoApply(m({ auto: false, hidden: true, idleMs: 10 * AUTO_UPDATE_IDLE_MS }))).toBe(false);
  });
});

describe("sprawdzanie aktualizacji", () => {
  it("co godzinę, gdy karta stoi otwarta", () => {
    expect(UPDATE_CHECK_MS).toBe(60 * 60_000);
  });
});

describe("resetAppFiles — wyłącznik awaryjny (S6.2)", () => {
  it("kasuje tylko pliki aplikacji, dane (skrzynka udostępnień, znaczniki powiadomień) zostają", async () => {
    const names = ["workbox-precache-v2-https://x/", "static-assets", "mermaid-engine", "html-navigations", "share-inbox-v1", "notki-push", "obca"];
    const deleted: string[] = [];
    const storage = { keys: async () => names, delete: async (n: string) => { deleted.push(n); return true; } } as unknown as CacheStorage;
    expect(await resetAppFiles(storage)).toBe(4);
    expect(deleted.sort()).toEqual(["html-navigations", "mermaid-engine", "static-assets", "workbox-precache-v2-https://x/"]);
  });

  it("bez Cache Storage nic nie robi", async () => {
    expect(await resetAppFiles(undefined)).toBe(0);
  });
});
