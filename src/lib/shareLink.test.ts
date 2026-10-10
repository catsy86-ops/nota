import { describe, it, expect } from "vitest";
import { encodeShareParam, parseShareParam, SHARE_PARAM_MAX_CHARS } from "./shareLink";

const enc = (v: unknown) => btoa(encodeURIComponent(JSON.stringify(v)));

describe("link udostępniania (?share=)", () => {
  it("round-trip poprawnej notatki", () => {
    const raw = encodeShareParam({ title: "Zażółć", content: "treść", checklist: [{ id: "1", text: "a", checked: true }], labels: ["x"], color: "mint" });
    expect(parseShareParam(raw)).toEqual({ title: "Zażółć", content: "treść", color: "mint", labels: ["x"], checklist: [{ id: "1", text: "a", checked: true }] });
  });

  it("zły typ pól nie przechodzi do notatki", () => {
    const r = parseShareParam(enc({ t: { a: 1 }, c: [1], co: "javascript:alert(1)", l: [{ x: 1 }, "ok", 7], cl: [null, "s", { text: { z: 1 }, checked: "tak" }] }))!;
    expect(r.title).toBe("");
    expect(r.content).toBe("");
    expect(r.color).toBe("default");
    expect(r.labels).toEqual(["ok"]);
    expect(r.checklist).toHaveLength(1);
    expect(r.checklist[0]).toMatchObject({ text: "", checked: false });
    expect(typeof r.checklist[0].id).toBe("string");
  });

  it("odrzuca nie-obiekty, śmieci i zbyt długi parametr", () => {
    expect(parseShareParam("")).toBeNull();
    expect(parseShareParam("%%%nie-base64")).toBeNull();
    expect(parseShareParam(enc(null))).toBeNull();
    expect(parseShareParam(enc([1, 2]))).toBeNull();
    expect(parseShareParam("A".repeat(SHARE_PARAM_MAX_CHARS + 1))).toBeNull();
  });

  it("ucina rozmiary", () => {
    const r = parseShareParam(enc({ t: "t".repeat(5000), c: "c".repeat(105_000), l: Array.from({ length: 500 }, () => "l"), cl: Array.from({ length: 600 }, (_, i) => ({ id: String(i), text: "x" })) }))!;
    expect(r.title).toHaveLength(1000);
    expect(r.content).toHaveLength(100_000);
    expect(r.labels).toHaveLength(50);
    expect(r.checklist).toHaveLength(500);
  });

  it("__proto__ w JSON nie zatruwa obiektów", () => {
    const raw = btoa(encodeURIComponent('{"__proto__":{"polluted":true},"t":"x"}'));
    const r = parseShareParam(raw)!;
    expect(r.title).toBe("x");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
