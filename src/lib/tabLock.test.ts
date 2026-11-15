import { describe, expect, it } from "vitest";
import { withExclusiveLock } from "./tabLock";

describe("withExclusiveLock", () => {
  it("wykonuje zadania jedno po drugim", async () => {
    const log: string[] = [];
    const task = (n: string, ms: number) => withExclusiveLock("t", async () => {
      log.push(`start ${n}`);
      await new Promise((r) => setTimeout(r, ms));
      log.push(`end ${n}`);
    });
    await Promise.all([task("a", 20), task("b", 1)]);
    expect(log).toEqual(["start a", "end a", "start b", "end b"]);
  });

  it("błąd jednego zadania nie blokuje kolejnych", async () => {
    await expect(withExclusiveLock("e", async () => { throw new Error("x"); })).rejects.toThrow("x");
    await expect(withExclusiveLock("e", async () => 5)).resolves.toBe(5);
  });
});
