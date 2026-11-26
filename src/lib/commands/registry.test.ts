import { describe, expect, it, vi } from "vitest";
import { commandGroups, commandsWithShortcuts, registerCommandSource, resolveLabel, type CommandContext } from "./registry";
import { registerBuiltinCommands } from "./builtin";

// A3.4: rejestr poleceń palety — kolejność grup, `when`, duplikaty, wycofanie źródła, skróty dla ściągi.

const ctx = (over: Partial<CommandContext> = {}): CommandContext => ({
  navigate: vi.fn(), go: vi.fn(), newNote: vi.fn(), quickInbox: vi.fn(), dailyNote: vi.fn(), periodNote: vi.fn(),
  openSettings: vi.fn(), openStats: vi.fn(), openFocusMode: vi.fn(), openShortcuts: vi.fn(), toggleTheme: vi.fn(),
  vaultPhase: "none", skin: "zeszyt", ...over,
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
