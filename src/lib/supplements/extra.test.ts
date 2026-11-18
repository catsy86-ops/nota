import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYSupplements } from "./ySupplements";
import { SUPPLEMENT_ENTRY_V } from "./model";

// Z-17.3 (`docs/plan-zgodnosc-i-obieg.md` §1.6, pozycja 2): nieznane pole odżywki przeżywa edycję.

const raw = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, name: "Magnez", dose: "1 tabl.", when: "rano", created: 1, brandUrl: "x", ...over });

describe("nieznane pola odżywki", () => {
  it("replace, usunięcie z „Cofnij” i kopia zachowują pole", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>("supplements");
    const y = createYSupplements(doc);
    y.add(raw("a") as never);
    const listMap = map;
    expect(listMap.get("a")).toMatchObject({ brandUrl: "x" });
    const a = y.get()[0];
    expect(a.extra).toEqual({ brandUrl: "x" });
    y.replace({ ...a, dose: "2 tabl." });
    expect(listMap.get("a")).toMatchObject({ dose: "2 tabl.", brandUrl: "x" });
    y.restore(y.remove("a")!);
    expect(listMap.get("a")).toMatchObject({ brandUrl: "x" });
    expect(JSON.parse(JSON.stringify(y.dump())).list[0]).toMatchObject({ brandUrl: "x" });
  });

  it("`updateSupplement` (wpis budowany od zera) przenosi pole i `v` z poprzedniego", async () => {
    const { addSupplement, updateSupplement } = await import("./store");
    const { yjsStore } = await import("@/lib/yjsStore");
    const y = createYSupplements(yjsStore.doc);
    const s = addSupplement({ name: "Witamina D", dose: "", when: "rano" } as never);
    expect(s).toBeTruthy();
    y.replace({ ...y.get().find((x) => x.id === s!.id)!, extra: { brandUrl: "x" }, v: SUPPLEMENT_ENTRY_V });
    const next = updateSupplement(s!.id, { name: "Witamina D3", dose: "1", when: "rano" });
    expect(next).toMatchObject({ name: "Witamina D3", extra: { brandUrl: "x" }, v: SUPPLEMENT_ENTRY_V });
  });

  it("`v` większe niż obsługiwane — odżywka niewidoczna", () => {
    const doc = new Y.Doc();
    const y = createYSupplements(doc);
    y.add(raw("a") as never);
    const listMap = doc.getMap<unknown>("supplements");
    listMap.set("b", raw("b", { v: SUPPLEMENT_ENTRY_V + 1 }));
    expect(y.get().map((s) => s.id)).toEqual(["a"]);
  });
});
