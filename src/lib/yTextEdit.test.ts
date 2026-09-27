import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { applyTextEdit, captureTextBase } from "./yTextEdit";

function pair(initial: string) {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.getText("t").insert(0, initial);
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const sync = () => {
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  };
  return { a: a.getText("t"), b: b.getText("t"), sync };
}

function edit(t: Y.Text, fn: () => void) {
  t.doc!.transact(fn);
}

describe("applyTextEdit", () => {
  it("zwykła edycja bez peera daje dokładnie szkic", () => {
    const { a } = pair("Ala ma kota");
    const base = captureTextBase(a);
    edit(a, () => applyTextEdit(a, base, "Ala ma psa i kota"));
    expect(a.toString()).toBe("Ala ma psa i kota");
  });

  it("nie kasuje zdania dopisanego przez peera w trakcie edycji (regresja P0 #1)", () => {
    const { a, b, sync } = pair("Pierwsze zdanie.");
    const base = captureTextBase(a); // A otwiera edytor

    edit(b, () => b.insert(b.length, " Zdanie peera."));
    sync(); // A dostaje zmianę peera, ale szkic jej nie zawiera

    edit(a, () => applyTextEdit(a, base, "Pierwsze, poprawione zdanie."));
    sync();

    expect(a.toString()).toBe("Pierwsze, poprawione zdanie. Zdanie peera.");
    expect(b.toString()).toBe(a.toString());
  });

  it("zachowuje wstawkę peera na początku, gdy lokalnie edytujemy koniec", () => {
    const { a, b, sync } = pair("środek koniec");
    const base = captureTextBase(a);
    edit(b, () => b.insert(0, "Początek "));
    sync();
    edit(a, () => applyTextEdit(a, base, "środek KONIEC"));
    sync();
    expect(a.toString()).toBe("Początek środek KONIEC");
  });

  it("wstawka peera w środku lokalnie usuwanego zakresu zostaje", () => {
    const { a, b, sync } = pair("aaa XXX bbb");
    const base = captureTextBase(a);
    edit(b, () => b.insert(5, "peer"));
    sync();
    edit(a, () => applyTextEdit(a, base, "aaa bbb"));
    sync();
    expect(a.toString()).toBe("aaa peerbbb");
  });

  it("kolejne zapisy w tej samej sesji nie dublują tekstu", () => {
    const { a, b, sync } = pair("x");
    let base = captureTextBase(a);
    edit(b, () => b.insert(1, " [peer]"));
    sync();
    edit(a, () => { base = applyTextEdit(a, base, "x 1"); });
    edit(a, () => { base = applyTextEdit(a, base, "x 1 2"); });
    sync();
    expect(a.toString()).toBe("x 1 2 [peer]");
    expect(base.text).toBe("x 1 2");
  });

  it("gdy peer usunął kotwicę, wstawka nie ginie", () => {
    const { a, b, sync } = pair("abc def");
    const base = captureTextBase(a);
    edit(b, () => b.delete(0, 4));
    sync();
    edit(a, () => applyTextEdit(a, base, "abc! def"));
    sync();
    expect(a.toString()).toContain("!");
    expect(a.toString()).toContain("def");
  });
});
