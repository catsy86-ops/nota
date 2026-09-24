import { describe, it, expect, beforeEach } from "vitest";
import { createPersistedStore } from "./persistedStore";

beforeEach(() => {
  localStorage.clear();
});

describe("createPersistedStore", () => {
  it("returns defaults when nothing is stored", () => {
    const store = createPersistedStore("test.defaults", { a: 1, b: "x" });
    expect(store.get()).toEqual({ a: 1, b: "x" });
  });

  it("persists and reloads a value across store instances (same key)", () => {
    const a = createPersistedStore("test.persist", { count: 0 });
    a.set({ count: 5 });

    const b = createPersistedStore("test.persist", { count: 0 });
    expect(b.get()).toEqual({ count: 5 });
  });

  it("notifies subscribers on set", () => {
    const store = createPersistedStore("test.notify", { n: 0 });
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls++; });

    store.set({ n: 1 });
    expect(calls).toBe(1);

    unsubscribe();
    store.set({ n: 2 });
    expect(calls).toBe(1);
  });

  it("merge shallow-fills defaults for keys missing in a stored object", () => {
    localStorage.setItem("test.merge", JSON.stringify({ a: 9 }));
    const store = createPersistedStore("test.merge", { a: 1, b: 2 }, {
      merge: (defaults, stored) => ({ ...defaults, ...stored }),
    });
    expect(store.get()).toEqual({ a: 9, b: 2 });
  });

  it("falls back to defaults for corrupt JSON when no custom merge is given", () => {
    localStorage.setItem("test.corrupt", "{not json");
    const store = createPersistedStore("test.corrupt", { ok: true });
    expect(store.get()).toEqual({ ok: true });
  });

  it("falls back to defaults for corrupt JSON that a custom merge/validator rejects", () => {
    localStorage.setItem("test.corrupt-validated", "{not json");
    const isValid = (v: unknown): v is string => v === "auto" || v === "winter";
    const store = createPersistedStore<string>("test.corrupt-validated", "auto", {
      merge: (defaults, stored) => (isValid(stored) ? stored : defaults),
    });
    expect(store.get()).toBe("auto");
  });

  it("accepts a legacy bare (non-JSON) string value via merge/validator", () => {
    localStorage.setItem("test.legacy", "winter");
    const isValid = (v: unknown): v is string => typeof v === "string" && ["auto", "winter"].includes(v);
    const store = createPersistedStore<string>("test.legacy", "auto", {
      merge: (defaults, stored) => (isValid(stored) ? stored : defaults),
    });
    expect(store.get()).toBe("winter");
  });

  it("runs onChange on every set()", () => {
    const seen: number[] = [];
    const store = createPersistedStore("test.onchange", 0, { onChange: (v) => seen.push(v) });
    store.set(1);
    store.set(2);
    expect(seen).toEqual([1, 2]);
  });

  it("notify() re-emits to subscribers without writing a new value", () => {
    const store = createPersistedStore("test.explicit-notify", { n: 0 });
    let calls = 0;
    store.subscribe(() => { calls++; });
    store.notify();
    expect(calls).toBe(1);
    expect(store.get()).toEqual({ n: 0 });
  });
});
