import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { startTabSync } from "./tabSync";

const tick = () => new Promise((r) => setTimeout(r, 30));

describe("synchronizacja między kartami", () => {
  it("zmiana w jednej karcie trafia do drugiej, a nowa karta dostaje to, czego nie miała", async () => {
    const name = `test-${Math.random()}`;
    const a = new Y.Doc();
    const b = new Y.Doc();
    const stopA = startTabSync(a, name);
    const stopB = startTabSync(b, name);
    a.getMap("notes").set("n1", "pierwsza");
    await tick();
    expect(b.getMap("notes").get("n1")).toBe("pierwsza");
    b.getMap("notes").set("n2", "druga");
    await tick();
    expect(a.getMap("notes").get("n2")).toBe("druga");

    // Trzecia karta otwarta później dostaje cały stan na prośbę.
    const c = new Y.Doc();
    const stopC = startTabSync(c, name);
    await tick();
    expect(c.getMap("notes").toJSON()).toEqual({ n1: "pierwsza", n2: "druga" });
    [stopA, stopB, stopC].forEach((s) => s());
  });
});
