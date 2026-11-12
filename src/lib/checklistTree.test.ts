import { describe, expect, it } from "vitest";
import type { ChecklistItem } from "@/hooks/useNotes";
import { childIds, toggleChecklistItem } from "./checklistTree";

const it_ = (id: string, checked = false, indent?: 1): ChecklistItem => ({ id, text: id, checked, ...(indent ? { indent } : {}) });
const list = [it_("a"), it_("a1", false, 1), it_("a2", true, 1), it_("b"), it_("b1", false, 1)];

describe("podzadania listy", () => {
  it("dzieci to kolejne wcięte pozycje do następnej głównej; podzadanie nie ma dzieci", () => {
    expect(childIds(list, "a")).toEqual(["a1", "a2"]);
    expect(childIds(list, "b")).toEqual(["b1"]);
    expect(childIds(list, "a1")).toEqual([]);
    expect(childIds(list, "nie-ma")).toEqual([]);
  });

  it("odhaczenie rodzica odhacza nieukończone podzadania; cofnięcie zostawia je", () => {
    const r = toggleChecklistItem(list, "a");
    expect(r.cascaded).toBe(1);
    expect(r.items.filter((i) => i.checked).map((i) => i.id)).toEqual(["a", "a1", "a2"]);
    expect(r.items.find((i) => i.id === "b1")?.checked).toBe(false);
    const back = toggleChecklistItem(r.items, "a");
    expect(back.cascaded).toBe(0);
    expect(back.items.filter((i) => i.checked).map((i) => i.id)).toEqual(["a1", "a2"]);
  });

  it("podzadanie odhacza się samo, bez rodzica", () => {
    const r = toggleChecklistItem(list, "b1");
    expect(r.items.filter((i) => i.checked).map((i) => i.id)).toEqual(["a2", "b1"]);
    expect(r.cascaded).toBe(0);
  });
});
