import { describe, expect, it } from "vitest";
import { composeSiteLists, itemKey, listItemValue, metaKey } from "./siteItems";
import type { PlanItem } from "./planItems";

const item = (id: string, text: string, at: number, doneAt?: number): PlanItem => ({ id, text, at, ...(doneAt !== undefined ? { doneAt } : {}) });

describe("plan na dziś w siteItems (P-5)", () => {
  it("pozycje planu składają się w listę karty po czasie dodania", () => {
    const b = item("b", "Zamówić złączki", 200);
    const a = item("a", "Sprawdzić szczelność", 100, 150);
    const entries: [string, unknown][] = [
      [metaKey("site1", "todo"), true],
      [itemKey("site1", "todo", b.id), listItemValue("todo", b)],
      [itemKey("site1", "todo", a.id), listItemValue("todo", a)],
    ];
    const lists = composeSiteLists(entries).get("site1");
    expect(lists?.plan?.map((p) => p.id)).toEqual(["a", "b"]);
    expect(lists?.plan?.[0].doneAt).toBe(150);
    expect(lists?.plan?.[1].doneAt).toBeUndefined();
  });
});
