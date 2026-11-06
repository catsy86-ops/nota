import { describe, expect, it } from "vitest";
import { cleanCustom, cleanCustomList, CUSTOM_TOPIC_MAX, ownTopicTitle } from "./custom";
import { studyLists } from "./studyProjection";

describe("własne tematy nauki (P4.6)", () => {
  it("temat ma nazwę, nie ma pola topic; pusta nazwa odrzucona", () => {
    expect(cleanCustom({ kind: "topic", id: "c-t1", title: "  Pompy ciepła  " })).toEqual({ kind: "topic", id: "c-t1", title: "Pompy ciepła" });
    expect(cleanCustom({ kind: "topic", id: "c-t2", title: "   " })).toBeNull();
    expect(cleanCustom({ kind: "topic", id: "c-t3", title: "x".repeat(CUSTOM_TOPIC_MAX + 1) })).toBeNull();
  });

  it("nazwa tematu z listy wpisów własnych", () => {
    const list = cleanCustomList([{ kind: "topic", id: "c-t1", title: "Pompy" }]);
    expect(ownTopicTitle(list, "c-t1")).toBe("Pompy");
    expect(ownTopicTitle(list, "c-nie")).toBeNull();
  });

  it("temat nie trafia do pytań ani do listy kontrolnej", () => {
    const lists = studyLists([{ kind: "topic", id: "c-t1", title: "Pompy" }]);
    expect(lists.questions.some((q) => q.id === "c-t1")).toBe(false);
    expect(lists.checklist.some((i) => i.id === "c-t1")).toBe(false);
  });
});
