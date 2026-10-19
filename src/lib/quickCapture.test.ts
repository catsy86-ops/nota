import { describe, it, expect } from "vitest";
import { applyCapture, extractCapture, describeToken, type CaptureContext } from "./quickCapture";
import { selectionToChecklist, isChecklistShortcut } from "./checklistPaste";

// Wtorek 2026-10-06 10:00
const NOW = new Date(2026, 9, 6, 10, 0, 0);
const ctx: CaptureContext = {
  labels: ["Praca", "dom", "pilne sprawy"],
  folders: [{ id: "f1", name: "Projekty" }, { id: "f2", name: "Praca domowa" }],
  now: NOW,
};

function run(content: string, title = "", c: CaptureContext = ctx) {
  const tokens = extractCapture({ title, content }, c);
  return { tokens, res: applyCapture({ title, content }, tokens) };
}

describe("etykiety", () => {
  it("dopasowuje istniejącą bez rozróżniania wielkości liter i usuwa token", () => {
    const { res } = run("kup mleko #PRACA");
    expect(res.labels).toEqual(["Praca"]);
    expect(res.newLabels).toEqual([]);
    expect(res.content).toBe("kup mleko");
  });
  it("nieistniejącą tworzy z pisownią użytkownika", () => {
    const { res } = run("pomysł #nowa-rzecz dalej");
    expect(res.labels).toEqual(["nowa-rzecz"]);
    expect(res.newLabels).toEqual(["nowa-rzecz"]);
    expect(res.content).toBe("pomysł dalej");
  });
  it("rozpoznaje etykietę wielowyrazową i polskie litery", () => {
    expect(run("a #pilne sprawy b").res.labels).toEqual(["pilne sprawy"]);
    expect(run("#żółć").res.labels).toEqual(["żółć"]);
  });
  it("deduplikuje powtórzone etykiety", () => {
    const { res } = run("#dom #DOM #dom");
    expect(res.labels).toEqual(["dom"]);
    expect(res.content).toBe("");
  });
  it("# w URL, nagłówku Markdown, C#, kodzie i numerze nie jest etykietą", () => {
    expect(run("https://x.pl/strona#sekcja").tokens).toHaveLength(0);
    expect(run("# Nagłówek\n## Drugi").tokens).toHaveLength(0);
    expect(run("piszę w C# codziennie").tokens).toHaveLength(0);
    expect(run("zgłoszenie #123").tokens).toHaveLength(0);
    expect(run("użyj `#tag` w kodzie").tokens).toHaveLength(0);
    expect(run("##tag").tokens).toHaveLength(0);
  });
  it("interpunkcja po etykiecie zostaje w tekście", () => {
    const { res } = run("zrób to #praca, potem reszta");
    expect(res.labels).toEqual(["Praca"]);
    expect(res.content).toBe("zrób to, potem reszta");
  });
  it("działa w tytule", () => {
    const { res } = run("treść", "Spotkanie #praca");
    expect(res.title).toBe("Spotkanie");
    expect(res.labels).toEqual(["Praca"]);
    expect(res.content).toBe("treść");
  });
});

describe("foldery", () => {
  it("ustawia istniejący folder bez rozróżniania wielkości liter", () => {
    const { res } = run("plan @projekty");
    expect(res.folderId).toBe("f1");
    expect(res.content).toBe("plan");
  });
  it("najdłuższa nazwa wygrywa (folder wielowyrazowy)", () => {
    expect(run("@Praca domowa lekcje").res.folderId).toBe("f2");
  });
  it("nieznany folder zostaje w tekście", () => {
    const { tokens, res } = run("ping @ktos tutaj");
    expect(tokens).toHaveLength(0);
    expect(res.content).toBe("ping @ktos tutaj");
    expect(res.folderId).toBeNull();
  });
  it("e-mail z @ nie jest folderem, nawet gdy domena pasuje do folderu", () => {
    expect(run("pisz na jan@projekty.pl").tokens).toHaveLength(0);
    expect(run("jan@projekty").tokens).toHaveLength(0);
  });
  it("prefiks nazwy folderu nie wystarcza", () => {
    expect(run("@projektyXYZ").tokens).toHaveLength(0);
  });
  it("kolizja: pierwszy folder wygrywa, drugi zostaje w tekście", () => {
    const { res } = run("@Projekty i @Praca domowa");
    expect(res.folderId).toBe("f1");
    expect(res.content).toContain("@Praca domowa");
  });
});

describe("priorytet", () => {
  it("samodzielny ! to średni, !! to wysoki", () => {
    expect(run("zrób to !").res.priority).toBe("medium");
    expect(run("zrób to !!").res.priority).toBe("high");
    expect(run("! zrób to").res.content).toBe("zrób to");
  });
  it("!! doklejone na końcu działa, pojedynczy ! przy słowie to wykrzyknik", () => {
    const a = run("zrób to!!");
    expect(a.res.priority).toBe("high");
    expect(a.res.content).toBe("zrób to");
    const b = run("Super!");
    expect(b.tokens).toHaveLength(0);
    expect(b.res.content).toBe("Super!");
  });
  it("!!! i ! w środku słowa nie są priorytetem", () => {
    expect(run("hej !!! hej").tokens).toHaveLength(0);
    expect(run("a!b").tokens).toHaveLength(0);
  });
  it("pierwszy wygrywa przy kolizji", () => {
    const { res } = run("! a !!");
    expect(res.priority).toBe("medium");
    expect(res.content).toBe("a !!");
  });
  it("hasPriority wyłącza rozpoznawanie", () => {
    expect(run("a !!", "", { ...ctx, hasPriority: true }).tokens).toHaveLength(0);
  });
});

describe("data", () => {
  it("tytuł z przyimkiem przed dniem („Lista na sobotę”) zachowuje całą frazę i nie ustawia przypomnienia", () => {
    const { tokens, res } = run("", "Lista na sobotę");
    expect(tokens).toHaveLength(0);
    expect(res.title).toBe("Lista na sobotę");
    expect(res.reminder).toBeNull();
  });
  it("tytuł bez przyimka nadal zamienia dzień w przypomnienie", () => {
    const { res } = run("", "Zadzwonić jutro 9:00");
    expect(res.title).toBe("Zadzwonić");
    expect(res.reminder?.getDate()).toBe(7);
  });
  it("rozpoznaje „jutro 9:00” na końcu i usuwa frazę", () => {
    const { tokens, res } = run("zadzwonić do lekarza jutro 9:00");
    expect(tokens.map((t) => t.kind)).toEqual(["date"]);
    expect(res.reminder?.getDate()).toBe(7);
    expect(res.reminder?.getHours()).toBe(9);
    expect(res.content).toBe("zadzwonić do lekarza");
  });
  it("obsługuje „za 2h”, dzień tygodnia z polskimi znakami i sam czas", () => {
    expect(run("kuchnia za 2h").res.reminder?.getHours()).toBe(12);
    expect(run("spotkanie piątek 14:30").res.reminder?.getDay()).toBe(5);
    expect(run("zebranie środa").res.reminder?.getDay()).toBe(3);
    expect(run("obiad 18:15").res.reminder?.getHours()).toBe(18);
  });
  it("fraza w środku zdania nie jest rozpoznawana", () => {
    expect(run("jutro 9:00 pójdę gdzieś").tokens).toHaveLength(0);
  });
  it("wersja „1.20” i zwykłe liczby nie są datą", () => {
    expect(run("wersja 1.20").tokens).toHaveLength(0);
    expect(run("rozdział 5").tokens).toHaveLength(0);
  });
  it("niepoprawna godzina nie jest datą", () => {
    expect(run("coś jutro 25:00").tokens).toHaveLength(0);
  });
  it("zignorowanie chipa zostawia frazę w tekście", () => {
    const { tokens } = run("kup chleb jutro 9:00");
    const r = applyCapture({ title: "", content: "kup chleb jutro 9:00" }, tokens, new Set([tokens[0].key]));
    expect(r.reminder).toBeNull();
    expect(r.content).toBe("kup chleb jutro 9:00");
  });
  it("hasReminder wyłącza rozpoznawanie", () => {
    expect(run("a jutro 9:00", "", { ...ctx, hasReminder: true }).tokens).toHaveLength(0);
  });
  it("sama fraza daty nie opróżnia notatki", () => {
    const { res } = run("jutro 9:00");
    expect(res.reminder).not.toBeNull();
    expect(res.content).toBe("jutro 9:00");
  });
  it("sama fraza daty znika, gdy notatka ma inną zawartość", () => {
    const tokens = extractCapture({ title: "", content: "jutro 9:00" }, ctx);
    const res = applyCapture({ title: "", content: "jutro 9:00" }, tokens, new Set(), true);
    expect(res.content).toBe("");
  });
});

describe("łączenie tokenów", () => {
  it("wszystko naraz, układ linii zostaje", () => {
    const content = "Raport kwartalny #praca @projekty !!\nszczegóły w mailu\nodesłać jutro 9:00";
    const { res } = run(content);
    expect(res.labels).toEqual(["Praca"]);
    expect(res.folderId).toBe("f1");
    expect(res.priority).toBe("high");
    expect(res.reminder).not.toBeNull();
    expect(res.content).toBe("Raport kwartalny\nszczegóły w mailu\nodesłać");
  });
  it("ignorowanie jednego tokenu zostawia go w tekście", () => {
    const { tokens } = run("a #dom b");
    const r = applyCapture({ title: "", content: "a #dom b" }, tokens, new Set([tokens[0].key]));
    expect(r.labels).toEqual([]);
    expect(r.content).toBe("a #dom b");
  });
  it("opisuje chipy po polsku", () => {
    const { tokens } = run("x #dom !! jutro 9:00");
    const labels = tokens.map((t) => describeToken(t, () => "jutro, 09:00").label);
    expect(labels).toEqual(["#dom", "Priorytet: wysoki", "Przypomnienie: jutro, 09:00"]);
  });
});

describe("selectionToChecklist", () => {
  const id = () => "x";
  it("zamienia zaznaczone linie i zostawia resztę", () => {
    const text = "intro\nmleko\nchleb\noutro";
    const start = text.indexOf("mleko");
    const r = selectionToChecklist(text, start + 1, text.indexOf("chleb") + 2, [], id)!;
    expect(r.checklist.map((i) => i.text)).toEqual(["mleko", "chleb"]);
    expect(r.content).toBe("intro\noutro");
  });
  it("bez zaznaczenia bierze bieżącą linię", () => {
    const r = selectionToChecklist("a\nb\nc", 2, 2, [], id)!;
    expect(r.checklist.map((i) => i.text)).toEqual(["b"]);
    expect(r.content).toBe("a\nc");
  });
  it("zdejmuje znaczniki i dopisuje za istniejącymi", () => {
    const r = selectionToChecklist("- [x] a", 0, 7, [{ id: "1", text: "stara", checked: false }], id)!;
    expect(r.checklist.map((i) => [i.text, i.checked])).toEqual([["stara", false], ["a", true]]);
    expect(r.content).toBe("");
  });
  it("linie z końca tekstu nie zostawiają pustej linii", () => {
    const r = selectionToChecklist("wstęp\nmleko\nchleb", 6, 17, [], id)!;
    expect(r.content).toBe("wstęp");
  });
  it("pusta linia to null", () => {
    expect(selectionToChecklist("a\n\nb", 2, 2, [], id)).toBeNull();
  });
  it("rozpoznaje skrót", () => {
    expect(isChecklistShortcut({ key: "L", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false })).toBe(true);
    expect(isChecklistShortcut({ key: "l", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })).toBe(false);
  });
});
