import { beforeEach, describe, expect, it } from "vitest";
import { loadRecentCommands, MAX_RECENT_COMMANDS, pushRecentCommand, saveRecentCommand } from "./recentCommands";

const KNOWN = ["notes", "shifts", "today", "trash"] as const;

describe("ostatnio użyte polecenia", () => {
  beforeEach(() => localStorage.clear());

  it("nowe polecenie idzie na początek, bez duplikatów, max 3", () => {
    expect(pushRecentCommand(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushRecentCommand(["a", "b", "c"], "d")).toEqual(["d", "a", "b"]);
    expect(pushRecentCommand([], "x")).toHaveLength(1);
    expect(MAX_RECENT_COMMANDS).toBe(3);
  });

  it("zapis i odczyt z localStorage", () => {
    saveRecentCommand(KNOWN, "shifts");
    saveRecentCommand(KNOWN, "today");
    expect(loadRecentCommands(KNOWN)).toEqual(["today", "shifts"]);
  });

  it("odrzuca nieznane i zepsute wartości z localStorage", () => {
    localStorage.setItem("kaczy.recentCommands.v1", JSON.stringify(["shifts", "nieznane", 7, "shifts", "trash"]));
    expect(loadRecentCommands(KNOWN)).toEqual(["shifts", "trash"]);
    localStorage.setItem("kaczy.recentCommands.v1", "{nie json");
    expect(loadRecentCommands(KNOWN)).toEqual([]);
  });
});
