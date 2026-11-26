import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYTraining } from "./yTraining";
import { EXERCISES } from "./catalog";
import { TRAINING_ENTRY_V } from "./model";

// Z-17.3 (`docs/plan-zgodnosc-i-obieg.md` §1.6, pozycja 3): nowe pola serii i wpisu przeżywają zapis. RIR jest od C2.3 znany (`rir`), tu przykład `tempo`.

const exerciseId = EXERCISES[0].id;

describe("nieznane pola treningu", () => {
  it("seria z `tempo` i znanym `rir`, wpis z `mood` — scalenie, „Cofnij”, kopia", () => {
    const y = createYTraining(new Y.Doc());
    y.mergeDump({ entries: [{ id: "e1", day: "2026-11-01", exerciseId, sets: [{ reps: 8, kg: 20, rir: 2, tempo: "3010" }], note: "", created: 1, mood: "dobrze" }] });
    const e = y.getEntries()[0];
    expect(e.extra).toEqual({ mood: "dobrze" });
    expect(e.sets[0]).toMatchObject({ rir: 2, extra: { tempo: "3010" } });
    y.restoreEntry(y.removeEntry("e1")!);
    const dump = JSON.parse(JSON.stringify(y.dump()));
    expect(dump.entries[0]).toMatchObject({ mood: "dobrze", sets: [{ reps: 8, kg: 20, rir: 2, tempo: "3010" }] });
    expect(dump.entries[0]).not.toHaveProperty("extra");
    const other = createYTraining(new Y.Doc());
    other.mergeDump(dump);
    expect(other.getEntries()[0].sets[0]).toMatchObject({ rir: 2, extra: { tempo: "3010" } });
  });

  it("`v` większe niż obsługiwane — wpis niewidoczny", () => {
    const y = createYTraining(new Y.Doc());
    y.mergeDump({ entries: [{ id: "e2", day: "2026-11-01", exerciseId, sets: [{ reps: 1 }], note: "", created: 1, v: TRAINING_ENTRY_V + 1 }] });
    expect(y.getEntries()).toEqual([]);
  });
});
