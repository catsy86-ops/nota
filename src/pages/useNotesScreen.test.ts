import { describe, expect, it, vi } from "vitest";
import { reminderWriters } from "./useNotesScreen";

describe("reminderWriters (Terminy i Kalendarz)", () => {
  it("nowy termin bez powtarzania: tylko addNote, bez patcha", () => {
    const addNote = vi.fn(() => "n1");
    const updateNote = vi.fn();
    reminderWriters(addNote, updateNote, "default").createReminderNote("Wizyta", 1000, "none", false);
    expect(addNote).toHaveBeenCalledWith("Wizyta", "", "default", [], 1000);
    expect(updateNote).not.toHaveBeenCalled();
  });

  it("nowy termin całodniowy dostaje reminderAllDay", () => {
    const updateNote = vi.fn();
    reminderWriters(() => "n1", updateNote, "default").createReminderNote("X", 1000, "none", true, 5000);
    expect(updateNote).toHaveBeenCalledWith("n1", expect.objectContaining({ reminderAllDay: true }));
    expect(updateNote.mock.calls[0][1]).not.toHaveProperty("reminderRepeatUntil");
  });

  it("dołączenie terminu bez powtarzania czyści koniec serii i nie ustawia reminderDay", () => {
    const updateNote = vi.fn();
    reminderWriters(() => "", updateNote, "default").attachReminder("a", 2000, "none", false, 1500, 9000);
    const patch = updateNote.mock.calls[0][1];
    expect(patch).toMatchObject({ reminder: 2000, reminderBase: 1500, reminderRepeatUntil: undefined, reminderAllDay: undefined });
    expect(patch).not.toHaveProperty("reminderDay");
  });

  it("setReminder z Kalendarza przenosi reminderDay", () => {
    const updateNote = vi.fn();
    reminderWriters(() => "", updateNote, "default").setReminder("a", 2000, "none", 15, undefined, true);
    expect(updateNote.mock.calls[0][1]).toMatchObject({ reminderDay: 15, reminderAllDay: true });
  });
});
