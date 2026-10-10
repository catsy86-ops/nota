import { describe, it, expect, beforeEach } from "vitest";
import { pushRecentSearch, loadRecentSearches, saveRecentSearch, clearRecentSearches } from "./recentSearches";

describe("recentSearches", () => {
  beforeEach(() => clearRecentSearches());

  it("dodaje na początek i usuwa duplikaty", () => {
    expect(pushRecentSearch(["a1", "b2"], "b2")).toEqual(["b2", "a1"]);
    expect(pushRecentSearch(["Raport"], "raport")).toEqual(["raport"]);
  });
  it("ogranicza do 5 i pomija zbyt krótkie", () => {
    const list = ["aa", "bb", "cc", "dd", "ee"];
    expect(pushRecentSearch(list, "ff")).toEqual(["ff", "aa", "bb", "cc", "dd"]);
    expect(pushRecentSearch(list, " x ")).toEqual(list);
  });
  it("zapisuje w localStorage i odczytuje", () => {
    saveRecentSearch("zakupy");
    saveRecentSearch("praca");
    expect(loadRecentSearches()).toEqual(["praca", "zakupy"]);
  });
  it("znosi uszkodzone dane", () => {
    localStorage.setItem("kaczy.recentSearches.v1", "{nie json");
    expect(loadRecentSearches()).toEqual([]);
    localStorage.setItem("kaczy.recentSearches.v1", JSON.stringify([1, "ok", null, ""]));
    expect(loadRecentSearches()).toEqual(["ok"]);
  });
});
