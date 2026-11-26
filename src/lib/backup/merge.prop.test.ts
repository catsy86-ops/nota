import { beforeEach, describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildFullBackup } from "./build";
import { parseFullBackup } from "./parse";
import { restoreFullBackup } from "./merge";
import { yjsStore } from "@/lib/yjsStore";
import { versionsStore } from "@/lib/versionsStore";
import { clearAllStorage } from "@/lib/notesStore";
import { addDebt, debtsDump, removeDebt } from "@/lib/debts/store";
import { addMeal, dietDump, removeMeal } from "@/lib/diet/store";
import { addTrainingEntry, removeTrainingEntry, trainingDump } from "@/lib/training/store";

/**
 * A4.5 (kopia, `merge.ts`): sekcje scalane (Długi, Dieta, Trening) — przywrócenie tej samej kopii dwa razy daje to samo
 * co raz (idempotencja), a przywracanie **niczego nie kasuje**: wpisy dodane po zrobieniu kopii zostają, a usunięte po
 * kopii wracają (kopia scala, nie zastępuje). Losowe stany przed i po kopii.
 */

const ALL = { versions: true, settings: true, achievements: true, shifts: true, study: true };

type Change = { k: "debt"; amount: number } | { k: "meal"; text: string } | { k: "train"; reps: number } | { k: "dropFirst"; what: "debt" | "meal" | "train" };

const changes = fc.array(fc.oneof(
  fc.record({ k: fc.constant("debt" as const), amount: fc.constantFrom(100, 2500, 10_000) }),
  fc.record({ k: fc.constant("meal" as const), text: fc.constantFrom("Owsianka", "Kefir") }),
  fc.record({ k: fc.constant("train" as const), reps: fc.integer({ min: 1, max: 12 }) }),
  fc.record({ k: fc.constant("dropFirst" as const), what: fc.constantFrom("debt" as const, "meal" as const, "train" as const) }),
), { maxLength: 6 });

function apply(cs: readonly Change[]) {
  for (const c of cs) {
    if (c.k === "debt") addDebt({ person: "Ania", kind: "lent", amount: c.amount, at: "2026-11-01" });
    else if (c.k === "meal") addMeal({ text: c.text, day: "2026-11-01" });
    else if (c.k === "train") addTrainingEntry({ exerciseId: "triceps-nad-glowa", sets: [{ reps: c.reps, kg: 8 }], day: "2026-11-01" });
    else if (c.what === "debt") { const id = debtsDump()[0]?.id; if (id) removeDebt(id); }
    else if (c.what === "meal") { const id = dietDump().meals[0]?.id; if (id) removeMeal(id); }
    else { const id = trainingDump().entries[0]?.id; if (id) removeTrainingEntry(id); }
  }
}

const ids = () => ({
  debts: debtsDump().map((e) => e.id).sort(),
  meals: dietDump().meals.map((m) => m.id).sort(),
  train: trainingDump().entries.map((e) => e.id).sort(),
});

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
  await yjsStore.resetForTests();
  versionsStore.replaceAll([]);
});

describe("scalanie kopii (A4.5, merge.ts)", () => {
  it("dwa razy = raz; po przywróceniu są wszystkie wpisy z kopii i wszystkie dodane po niej", async () => {
    await fc.assert(fc.asyncProperty(changes, changes, async (before, after) => {
      localStorage.clear();
      await clearAllStorage();
      await yjsStore.resetForTests();
      apply(before);
      const inBackup = ids();
      const backup = await parseFullBackup(JSON.stringify(await buildFullBackup()));
      apply(after);
      const beforeRestore = ids();

      await restoreFullBackup(backup, ALL);
      const once = ids();
      await restoreFullBackup(backup, ALL);
      expect(ids()).toEqual(once);

      for (const k of ["debts", "meals", "train"] as const) {
        const got = new Set(once[k]);
        for (const id of inBackup[k]) expect(got.has(id), `${k}: z kopii ${id}`).toBe(true);
        for (const id of beforeRestore[k]) expect(got.has(id), `${k}: dodany po kopii ${id}`).toBe(true);
      }
    }), { numRuns: 15 });
  }, 120_000);
});
