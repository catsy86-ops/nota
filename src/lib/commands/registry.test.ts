import { describe, expect, it, vi } from "vitest";
import { cheatSheetGroups, commandGroups, commandsWithShortcuts, registerCommandSource, resolveLabel, resolveShortcut, type CommandContext } from "./registry";
import { registerBuiltinCommands } from "./builtin";

// A3.4: rejestr poleceń palety — kolejność grup, `when`, duplikaty, wycofanie źródła, skróty dla ściągi.

const ctx = (over: Partial<CommandContext> = {}): CommandContext => ({
  navigate: vi.fn(), go: vi.fn(), newNote: vi.fn(), quickInbox: vi.fn(), dailyNote: vi.fn(), periodNote: vi.fn(),
  openSettings: vi.fn(), openStats: vi.fn(), openFocusMode: vi.fn(), openShortcuts: vi.fn(), toggleTheme: vi.fn(), setThemeMode: vi.fn(),
  vaultPhase: "none", skin: "zeszyt", hasQuery: false, font: "default", ...over,
});

registerBuiltinCommands();

describe("rejestr poleceń (A3.4)", () => {
  it("wbudowane grupy w kolejności: Kalendarz, Praca, Grafik, Akcje", () => {
    expect(commandGroups(ctx()).map((g) => g.heading)).toEqual(["Kalendarz", "Praca", "Grafik", "Akcje"]);
  });

  it("`when`: kopiowanie tylko przy bieżącej notatce, blokada i odblokowanie wg skarbca", () => {
    const ids = (c: CommandContext) => commandGroups(c).flatMap((g) => g.commands.map((x) => x.id));
    expect(ids(ctx())).not.toContain("akcje.kopiuj-md");
    expect(ids(ctx({ copyNote: vi.fn() }))).toContain("akcje.kopiuj-md");
    expect(ids(ctx({ vaultPhase: "unlocked" }))).toContain("akcje.zablokuj");
    expect(ids(ctx({ vaultPhase: "unlocked" }))).not.toContain("akcje.odblokuj");
    expect(ids(ctx({ vaultPhase: "locked" }))).toContain("akcje.odblokuj");
  });

  it("dział dopisuje źródło bez zmian w palecie; wycofanie je zdejmuje; zduplikowane id odrzucone", () => {
    const run = vi.fn();
    const off = registerCommandSource({ group: "Test", order: 5, commands: [{ id: "test.x", label: (c) => `X ${c.skin}`, run }] });
    const groups = commandGroups(ctx());
    expect(groups[0].heading).toBe("Test");
    expect(resolveLabel(groups[0].commands[0], ctx())).toBe("X zeszyt");
    expect(() => registerCommandSource({ group: "Inna", order: 6, commands: [{ id: "test.x", label: "Y", run }] })).toThrow(/test\.x/);
    off();
    expect(commandGroups(ctx()).map((g) => g.heading)).not.toContain("Test");
  });

  it("polecenie wywołuje kontekst palety", () => {
    const c = ctx();
    const go = (id: string) => commandGroups(c).flatMap((g) => g.commands).find((x) => x.id === id)!.run(c);
    go("akcje.nowa-notatka");
    go("praca.nowy-wpis");
    go("grafik.cykl");
    expect(c.newNote).toHaveBeenCalled();
    expect(c.navigate).toHaveBeenCalledWith("/praca?wpis=1");
    expect(c.go).toHaveBeenCalledWith("shifts");
  });

  it("polecenia ze skrótem — dla ściągi (Q5.2)", () => {
    const ids = commandsWithShortcuts().map((x) => x.command.id);
    expect(ids).toEqual(expect.arrayContaining(["akcje.nowa-notatka", "akcje.do-skrzynki", "akcje.skroty"]));
  });
});

describe("więcej poleceń (Powłoka 2.5)", () => {
  const ids = (c: CommandContext) => commandGroups(c).flatMap((g) => g.commands.map((x) => x.id));

  it("pusta paleta: bez list stylów, krojów i jasności; „Zrób kopię teraz” zawsze", () => {
    const all = ids(ctx());
    expect(all).toContain("akcje.zrob-kopie");
    expect(all.some((id) => id.startsWith("styl.") || id.startsWith("kroj.") || id.startsWith("jasnosc."))).toBe(false);
  });

  it("z tekstem: style i kroje bez bieżącego, cztery tryby jasności", () => {
    const all = ids(ctx({ hasQuery: true, skin: "neon", font: "inter" }));
    expect(all).toContain("styl.zeszyt");
    expect(all).not.toContain("styl.neon");
    expect(all).toContain("kroj.lexend");
    expect(all).not.toContain("kroj.inter");
    expect(all.filter((id) => id.startsWith("jasnosc."))).toEqual(["jasnosc.light", "jasnosc.dark", "jasnosc.system", "jasnosc.time"]);
  });

  it("jasność idzie przez kontekst palety", () => {
    const c = ctx({ hasQuery: true });
    commandGroups(c).flatMap((g) => g.commands).find((x) => x.id === "jasnosc.dark")!.run(c);
    expect(c.setThemeMode).toHaveBeenCalledWith("dark");
  });

  it("„Wyślij kopię” tylko tam, gdzie przeglądarka udostępnia pliki", () => {
    expect(ids(ctx())).not.toContain("akcje.wyslij-kopie");
    const nav = navigator as unknown as { share?: unknown; canShare?: unknown };
    nav.share = () => Promise.resolve();
    nav.canShare = () => true;
    try { expect(ids(ctx())).toContain("akcje.wyslij-kopie"); } finally { delete nav.share; delete nav.canShare; }
  });
});

describe("ściąga skrótów z rejestru (Q5.2)", () => {
  it("każdy skrót polecenia rozwiązuje się z tabeli `shortcuts.ts` — bez rozjazdu", () => {
    for (const { command } of commandsWithShortcuts()) expect(resolveShortcut(command), command.id).toBeTruthy();
    const by = new Map(commandsWithShortcuts().map((x) => [x.command.id, resolveShortcut(x.command)]));
    expect(by.get("akcje.do-skrzynki")).toBe("Alt+K");
    expect(by.get("akcje.statystyki")).toBe("Alt+I");
    expect(by.get("akcje.skroty")).toBe("?");
    expect(by.get("akcje.nowa-notatka")).toMatch(/\+N$/);
  });

  it("grupy ściągi: bez stylów i krojów, z akcjami i Pracą", () => {
    const headings = cheatSheetGroups().map((g) => g.heading);
    expect(headings).toEqual(expect.arrayContaining(["Akcje", "Praca", "Kalendarz", "Grafik"]));
    expect(headings).not.toContain("Styl");
    expect(headings).not.toContain("Krój i jasność");
  });
});
