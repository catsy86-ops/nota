import { describe, expect, it } from "vitest";
import { continueList, duplicateLines, indentList, insertLink, isListLineAt, moveLines, toggleWrap } from "./editorKeys";

/** Zapis testowy: `|` to karetka, `[` `]` to granice zaznaczenia (bez nawiasów w treści). */
function mk(src: string) {
  const a = src.indexOf("⟦");
  if (a === -1) {
    const c = src.indexOf("|");
    return { value: src.replace("|", ""), s: c, e: c };
  }
  const b = src.indexOf("⟧") - 1;
  return { value: src.replace("⟦", "").replace("⟧", ""), s: a, e: b };
}
function show(r: { value: string; selStart: number; selEnd: number } | null) {
  if (!r) return null;
  if (r.selStart === r.selEnd) return r.value.slice(0, r.selStart) + "|" + r.value.slice(r.selStart);
  return r.value.slice(0, r.selStart) + "⟦" + r.value.slice(r.selStart, r.selEnd) + "⟧" + r.value.slice(r.selEnd);
}
const wrap = (src: string, m: "**" | "*") => { const x = mk(src); return show(toggleWrap(x.value, x.s, x.e, m)); };
const link = (src: string) => { const x = mk(src); return show(insertLink(x.value, x.s, x.e)); };
const enter = (src: string) => { const x = mk(src); return show(continueList(x.value, x.s, x.e)); };
const tab = (src: string, out = false) => { const x = mk(src); return show(indentList(x.value, x.s, x.e, out)); };
const move = (src: string, d: "up" | "down") => { const x = mk(src); return show(moveLines(x.value, x.s, x.e, d)); };
const dup = (src: string, d: "up" | "down" = "down") => { const x = mk(src); return show(duplicateLines(x.value, x.s, x.e, d)); };

describe("toggleWrap", () => {
  it("otacza zaznaczenie i zachowuje je", () => {
    expect(wrap("ala ⟦ma⟧ kota", "**")).toBe("ala **⟦ma⟧** kota");
    expect(wrap("ala ⟦ma⟧ kota", "*")).toBe("ala *⟦ma⟧* kota");
  });
  it("zdejmuje znaczniki z zewnątrz", () => {
    expect(wrap("ala **⟦ma⟧** kota", "**")).toBe("ala ⟦ma⟧ kota");
    expect(wrap("ala *⟦ma⟧* kota", "*")).toBe("ala ⟦ma⟧ kota");
  });
  it("zdejmuje znaczniki, gdy zaznaczono je razem z tekstem", () => {
    expect(wrap("ala ⟦**ma**⟧ kota", "**")).toBe("ala ⟦ma⟧ kota");
    expect(wrap("ala ⟦*ma*⟧ kota", "*")).toBe("ala ⟦ma⟧ kota");
  });
  it("kursywa na pogrubieniu dodaje, a nie zdejmuje", () => {
    expect(wrap("**⟦ma⟧**", "*")).toBe("***⟦ma⟧***");
  });
  it("zdejmuje tylko jeden poziom z ***", () => {
    expect(wrap("***⟦ma⟧***", "*")).toBe("**⟦ma⟧**");
    expect(wrap("***⟦ma⟧***", "**")).toBe("*⟦ma⟧*");
  });
  it("puste zaznaczenie wstawia parę z karetką w środku", () => {
    expect(wrap("ala |kota", "**")).toBe("ala **|**kota");
    expect(wrap("|", "*")).toBe("*|*");
  });
  it("puste zaznaczenie w pustej parze ją usuwa", () => {
    expect(wrap("ala **|** kota", "**")).toBe("ala | kota");
    expect(wrap("ala *|* kota", "*")).toBe("ala | kota");
  });
  it("obcina białe znaki z brzegów zaznaczenia", () => {
    expect(wrap("ala ⟦ ma ⟧kota", "**")).toBe("ala  **⟦ma⟧** kota");
  });
  it("same białe znaki działają jak pusty kursor", () => {
    expect(wrap("a⟦  ⟧b", "**")).toBe("a  **|**b");
  });
  it("polskie znaki", () => {
    expect(wrap("⟦zażółć gęślą⟧ jaźń", "**")).toBe("**⟦zażółć gęślą⟧** jaźń");
    expect(wrap("**⟦żółć⟧**", "**")).toBe("⟦żółć⟧");
  });
  it("granice tekstu", () => {
    expect(wrap("⟦a⟧", "**")).toBe("**⟦a⟧**");
    expect(wrap("**⟦a⟧**", "**")).toBe("⟦a⟧");
  });
  it("wiele linii: znacznik na każdą linię osobno", () => {
    expect(wrap("⟦jeden\ndwa⟧", "**")).toBe("⟦**jeden**\n**dwa**⟧");
  });
  it("wiele linii zdejmuje, gdy wszystkie są otoczone", () => {
    expect(wrap("⟦**jeden**\n**dwa**⟧", "**")).toBe("⟦jeden\ndwa⟧");
  });
  it("wiele linii pomija puste i znaczniki list", () => {
    expect(wrap("⟦- jeden\n\n- dwa⟧", "**")).toBe("- ⟦**jeden**\n\n- **dwa**⟧");
  });
  it("częściowo otoczone linie zostają i reszta dostaje znacznik", () => {
    expect(wrap("⟦**jeden**\ndwa⟧", "**")).toBe("⟦**jeden**\n**dwa**⟧");
  });
  it("dwa pogrubienia zaznaczone razem nie są jednym", () => {
    expect(wrap("⟦**a** i **b**⟧", "**")).toBe("**⟦**a** i **b**⟧**");
  });
  it("odwrócone zaznaczenie (selStart > selEnd) działa tak samo", () => {
    const r = toggleWrap("ala ma kota", 6, 4, "**");
    expect(show(r)).toBe("ala **⟦ma⟧** kota");
  });
});

describe("insertLink", () => {
  it("zaznaczenie → [tekst](url) z zaznaczonym url", () => {
    expect(link("zobacz ⟦ten tekst⟧ dziś")).toBe("zobacz [ten tekst](⟦url⟧) dziś");
  });
  it("bez zaznaczenia → [](url) z karetką w nawiasie kwadratowym", () => {
    expect(link("a |b")).toBe("a [|](url)b");
  });
  it("zaznaczony adres trafia do url", () => {
    expect(link("⟦https://example.com/x⟧")).toBe("[|](https://example.com/x)");
    expect(link("⟦www.kot.pl⟧")).toBe("[|](www.kot.pl)");
  });
  it("zdejmuje link, gdy zaznaczono go w całości", () => {
    expect(link("a ⟦[tekst](url)⟧ b")).toBe("a ⟦tekst⟧ b");
  });
  it("zdejmuje link, gdy karetka jest w jego tekście", () => {
    expect(link("a [te|kst](http://x.pl) b")).toBe("a te|kst b");
  });
  it("zdejmuje link, gdy zaznaczenie jest w tekście linku", () => {
    expect(link("[⟦ala⟧ ma](u)")).toBe("⟦ala⟧ ma");
  });
  it("nie zdejmuje linku z innej linii ani sąsiedniego tekstu", () => {
    expect(link("[a](b)\nzdanie ⟦tu⟧")).toBe("[a](b)\nzdanie [tu](⟦url⟧)");
  });
  it("polskie znaki", () => {
    expect(link("⟦źdźbło⟧")).toBe("[źdźbło](⟦url⟧)");
  });
});

describe("continueList", () => {
  it("kontynuuje punktor", () => {
    expect(enter("- ala|")).toBe("- ala\n- |");
    expect(enter("* ala|")).toBe("* ala\n* |");
    expect(enter("+ ala|")).toBe("+ ala\n+ |");
  });
  it("numeracja +1 i ten sam ogranicznik", () => {
    expect(enter("1. ala|")).toBe("1. ala\n2. |");
    expect(enter("9. ala|")).toBe("9. ala\n10. |");
    expect(enter("3) ala|")).toBe("3) ala\n4) |");
  });
  it("lista zadań: nowa pozycja nieodhaczona", () => {
    expect(enter("- [x] zrobione|")).toBe("- [x] zrobione\n- [ ] |");
    expect(enter("- [ ] do zrobienia|")).toBe("- [ ] do zrobienia\n- [ ] |");
  });
  it("zachowuje wcięcie", () => {
    expect(enter("  - ala|")).toBe("  - ala\n  - |");
  });
  it("pusty znacznik kończy listę", () => {
    expect(enter("- ala\n- |")).toBe("- ala\n|");
    expect(enter("1. a\n2. |")).toBe("1. a\n|");
    expect(enter("- [ ] |")).toBe("|");
  });
  it("Enter w środku tekstu przenosi resztę do nowej pozycji", () => {
    expect(enter("- ala| ma kota")).toBe("- ala\n-  ma kota".replace("-  ma", "- | ma"));
  });
  it("karetka w samym znaczniku lub poza listą → null", () => {
    expect(enter("-| ala")).toBeNull();
    expect(enter("zwykły tekst|")).toBeNull();
    expect(enter("**pogrubione**|")).toBeNull();
    expect(enter("---|")).toBeNull();
  });
  it("zaznaczenie → null", () => {
    expect(enter("- ⟦ala⟧")).toBeNull();
  });
  it("polskie znaki i kolejne linie", () => {
    expect(enter("- żółć|\n- inna")).toBe("- żółć\n- |\n- inna");
  });
});

describe("indentList", () => {
  it("Tab wcina linię listy o 2 spacje i przesuwa karetkę", () => {
    expect(tab("- ala|")).toBe("  - ala|");
    expect(tab("a\n- al|a")).toBe("a\n  - al|a");
  });
  it("Shift+Tab zdejmuje do 2 spacji", () => {
    expect(tab("    - ala|", true)).toBe("  - ala|");
    expect(tab(" - ala|", true)).toBe("- ala|");
  });
  it("Shift+Tab bez wcięcia → null (fokus może wyjść)", () => {
    expect(tab("- ala|", true)).toBeNull();
  });
  it("poza listą → null", () => {
    expect(tab("zwykły tekst|")).toBeNull();
    expect(tab("zwykły tekst|", true)).toBeNull();
  });
  it("zaznaczone linie: wcina tylko linie listy", () => {
    expect(tab("⟦- a\ntekst\n- b⟧")).toBe("  ⟦- a\ntekst\n  - b⟧");
  });
  it("numerowana i zadania", () => {
    expect(tab("1. a|")).toBe("  1. a|");
    expect(tab("- [ ] a|")).toBe("  - [ ] a|");
  });
  it("karetka na początku linii zostaje przed tekstem", () => {
    expect(tab("|- ala")).toBe("  |- ala");
  });
});

describe("isListLineAt", () => {
  it("rozpoznaje linię listy", () => {
    expect(isListLineAt("a\n- b", 4)).toBe(true);
    expect(isListLineAt("a\n- b", 0)).toBe(false);
  });
});

describe("moveLines", () => {
  it("w górę i w dół zamienia z sąsiednią linią", () => {
    expect(move("a\nb|\nc", "up")).toBe("b|\na\nc");
    expect(move("a\nb|\nc", "down")).toBe("a\nc\nb|");
  });
  it("zachowuje pozycję karetki w linii", () => {
    expect(move("a\nbcd\nc".replace("bcd", "b|cd"), "up")).toBe("b|cd\na\nc");
  });
  it("na krawędziach → null", () => {
    expect(move("a|\nb", "up")).toBeNull();
    expect(move("a\nb|", "down")).toBeNull();
    expect(move("jedna|", "up")).toBeNull();
  });
  it("przenosi zaznaczone linie razem", () => {
    expect(move("a\n⟦b\nc⟧\nd", "up")).toBe("⟦b\nc⟧\na\nd");
    expect(move("a\n⟦b\nc⟧\nd", "down")).toBe("a\nd\n⟦b\nc⟧");
  });
  it("zaznaczenie kończące się na początku linii nie bierze tej linii", () => {
    const r = moveLines("a\nb\nc", 2, 4, "down"); // „b\n”
    expect(r?.value).toBe("a\nc\nb");
  });
  it("polskie znaki i puste linie", () => {
    expect(move("żółć\n|\nzażółć", "down")).toBe("żółć\nzażółć\n|");
  });
});

describe("duplicateLines", () => {
  it("duplikuje linię w dół, karetka na kopii", () => {
    expect(dup("a|b\nc")).toBe("ab\na|b\nc");
  });
  it("duplikuje w górę, karetka zostaje", () => {
    expect(dup("a|b\nc", "up")).toBe("a|b\nab\nc");
  });
  it("duplikuje zaznaczone linie", () => {
    expect(dup("⟦a\nb⟧\nc")).toBe("a\nb\n⟦a\nb⟧\nc");
  });
  it("ostatnia linia bez końcowego \\n", () => {
    expect(dup("a\nb|")).toBe("a\nb\nb|");
  });
});
