import { collectSources } from "./collect";
import { buildImportPlan, type ExistingNoteLike, type ImportPlan } from "./plan";

export type { ImportPlan, PlannedNote, ExistingNoteLike } from "./plan";
export type { ImportResult } from "./commit";
export { commitImportPlan, undoImport } from "./commit";

/** Wybrane pliki/folder/ZIP → plan importu (bez zapisu). */
export async function analyzeFiles(files: File[], existing: ExistingNoteLike[]): Promise<ImportPlan> {
  const collected = await collectSources(files);
  const plan = await buildImportPlan(collected.sources, existing);
  plan.warnings.unshift(...collected.warnings);
  plan.failures.unshift(...collected.failures);
  plan.counts.failed += collected.failures.length;
  return plan;
}
