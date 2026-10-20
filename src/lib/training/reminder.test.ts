import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { cleanTrainingReminder, TRAINING_REMINDER_DEFAULT, TRAINING_WINDOW_END } from "./model";
import { createYTraining } from "./yTraining";

describe("przypomnienie o treningu — czyszczenie", () => {
  it("domyślna godzina to 18:00, a okno kończy się o 20:00", () => {
    expect(TRAINING_REMINDER_DEFAULT).toBe("18:00");
    expect(TRAINING_WINDOW_END).toBe("20:00");
  });

  it("poprawna godzina z id zostaje; zła godzina = brak przypomnienia", () => {
    expect(cleanTrainingReminder({ time: "18:00", noteId: "n1" })).toEqual({ time: "18:00", noteId: "n1" });
    expect(cleanTrainingReminder({ time: "18:00" })).toEqual({ time: "18:00" });
    expect(cleanTrainingReminder({ time: "9:00" })).toBeNull();
    expect(cleanTrainingReminder(null)).toBeNull();
  });
});

describe("przypomnienie o treningu — Yjs i kopia", () => {
  it("ustawienie zapisuje się i zdejmuje", () => {
    const y = createYTraining(new Y.Doc());
    y.setReminder({ time: "18:00", noteId: "n1" });
    expect(y.getReminder()).toEqual({ time: "18:00", noteId: "n1" });
    y.setReminder(null);
    expect(y.getReminder()).toBeNull();
  });

  it("scalanie z kopii ustawia przypomnienie tylko wtedy, gdy go lokalnie nie ma", () => {
    const y = createYTraining(new Y.Doc());
    y.mergeDump({ entries: [], plans: [], reminder: { time: "19:00" } });
    expect(y.getReminder()).toEqual({ time: "19:00" });
    y.mergeDump({ entries: [], plans: [], reminder: { time: "07:00" } });
    expect(y.getReminder()).toEqual({ time: "19:00" });
  });
});
