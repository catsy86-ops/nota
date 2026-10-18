import { describe, expect, it } from "vitest";
import { parsePendingAction, withoutActionParam } from "./notificationAction";

describe("parsePendingAction", () => {
  it("czyta akcję i id notatki z adresu otwartego przez powiadomienie", () => {
    expect(parsePendingAction("/notatka/n1", "?akcja=done")).toEqual({ noteId: "n1", action: "done" });
    expect(parsePendingAction("/notatka/a%20b", "?akcja=snooze10")).toEqual({ noteId: "a b", action: "snooze10" });
  });

  it("ignoruje nieznaną akcję, brak akcji i inne trasy", () => {
    expect(parsePendingAction("/notatka/n1", "?akcja=usun")).toBeNull();
    expect(parsePendingAction("/notatka/n1", "")).toBeNull();
    expect(parsePendingAction("/grafik", "?akcja=done")).toBeNull();
  });

  it("nie wywraca się na zepsutym kodowaniu id", () => {
    expect(parsePendingAction("/notatka/%E0%A4%A", "?akcja=done")).toBeNull();
  });
});

describe("withoutActionParam", () => {
  it("usuwa tylko `akcja`, resztę zostawia", () => {
    expect(withoutActionParam("?akcja=done")).toBe("");
    expect(withoutActionParam("?q=x&akcja=done")).toBe("?q=x");
  });
});
