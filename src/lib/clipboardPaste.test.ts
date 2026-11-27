import { describe, expect, it } from "vitest";
import { linkOverSelection, pastedImageFiles } from "@/lib/clipboardPaste";
import { parsePastedChecklist } from "@/lib/checklistPaste";

describe("Q3.6: adres na zaznaczeniu", () => {
  it("sam adres http(s) na zaznaczonym tekście robi link Markdown", () => {
    expect(linkOverSelection("https://hurtownia.pl/zlaczki", "złączki PP")).toBe("[złączki PP](https://hurtownia.pl/zlaczki)");
    expect(linkOverSelection("  https://x.pl  ", "x")).toBe("[x](https://x.pl)");
  });

  it("nawiasy w tekście i adresie nie łamią składni", () => {
    expect(linkOverSelection("https://pl.wikipedia.org/wiki/Rura_(instalacja)", "rura [PP]")).toBe("[rura \\[PP\\]](https://pl.wikipedia.org/wiki/Rura_%28instalacja%29)");
  });

  it("zwykłe wklejenie: bez zaznaczenia, tekst zamiast adresu, kilka linii albo adres na adresie", () => {
    expect(linkOverSelection("https://x.pl", "")).toBeNull();
    expect(linkOverSelection("zwykły tekst", "słowo")).toBeNull();
    expect(linkOverSelection("javascript:alert(1)", "słowo")).toBeNull();
    expect(linkOverSelection("https://x.pl", "dwie\nlinie")).toBeNull();
    expect(linkOverSelection("https://nowy.pl", "https://stary.pl")).toBeNull();
  });

  it("obrazy ze schowka: tylko pliki image/*", () => {
    const files = [new File(["a"], "zrzut.png", { type: "image/png" }), new File(["b"], "faktura.pdf", { type: "application/pdf" })];
    expect(pastedImageFiles({ files: files as unknown as FileList }).map((f) => f.name)).toEqual(["zrzut.png"]);
    expect(pastedImageFiles(null)).toEqual([]);
  });
});

describe("Q3.6: listy z innych aplikacji do listy zadań", () => {
  it("Word w zwykłym tekście: punktory · i o z tabulatorem, § z wcięciem", () => {
    const word = "·\tRury PP 20 mm\no\tkolana 90°\n·\tZawór kulowy\n§\tteflon";
    expect(parsePastedChecklist(word)?.map((i) => i.text)).toEqual(["Rury PP 20 mm", "kolana 90°", "Zawór kulowy", "teflon"]);
  });

  it("Keep: pola wyboru jako znaki, odhaczone z ptaszkiem", () => {
    const keep = "☐ Mleko\n☑ Chleb\n☐ Jajka";
    expect(parsePastedChecklist(keep)).toEqual([
      { text: "Mleko", checked: false },
      { text: "Chleb", checked: true },
      { text: "Jajka", checked: false },
    ]);
  });

  it("WhatsApp: kropki, myślniki, ✅ jako odhaczone", () => {
    const wa = "• silikon\n- pianka\n– kołki 8 mm\n✅ wiertło 10";
    expect(parsePastedChecklist(wa)).toEqual([
      { text: "silikon", checked: false },
      { text: "pianka", checked: false },
      { text: "kołki 8 mm", checked: false },
      { text: "wiertło 10", checked: true },
    ]);
  });

  it("słowo zaczynające się od „o” bez tabulatora zostaje całe", () => {
    expect(parsePastedChecklist("okno w kuchni\nodpływ liniowy")?.map((i) => i.text)).toEqual(["okno w kuchni", "odpływ liniowy"]);
  });
});
