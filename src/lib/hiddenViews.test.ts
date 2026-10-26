import { beforeEach, describe, expect, it, vi } from "vitest";
import { hiddenViewsStore, isViewShown, setViewHidden } from "./hiddenViews";

beforeEach(() => {
  localStorage.clear();
  hiddenViewsStore.set([]);
});

/** Wczytuje moduł od nowa, żeby odczyt z `localStorage` odbył się od zera. */
async function loadFromStorage(raw: string) {
  localStorage.setItem("kaczy.hiddenViews.v1", raw);
  vi.resetModules();
  const mod = await import("./hiddenViews");
  return mod.hiddenViewsStore.get();
}

describe("ukrywanie działów (PW-3)", () => {
  it("ukrycie i pokazanie zmieniają listę, bez duplikatów", () => {
    setViewHidden("debts", true);
    setViewHidden("debts", true);
    expect(hiddenViewsStore.get()).toEqual(["debts"]);
    expect(isViewShown(hiddenViewsStore.get(), "debts")).toBe(false);
    setViewHidden("debts", false);
    expect(hiddenViewsStore.get()).toEqual([]);
  });

  it("odczyt odrzuca nieznane i działy zawsze widoczne (Notatki, Dziś, Archiwum, Kosz)", async () => {
    expect(await loadFromStorage(JSON.stringify(["shifts", "notes", "trash", "dawny-widok", "today"]))).toEqual(["shifts"]);
  });

  it("uszkodzony zapis nie ukrywa niczego", async () => {
    expect(await loadFromStorage(JSON.stringify({ debts: true }))).toEqual([]);
  });
});
