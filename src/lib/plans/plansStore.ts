import { useCallback, useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import type { AnalysisProject, PlanCalibration, PlanColor, PlanImage } from "./model";
import { createYPlans, type EntityKind, type PlanData, type PlanEntries } from "./yPlans";

/** Analizy planów żyją w dokumencie Yjs notatek (`yPlans.ts`); widoki zmieniają je tylko akcjami poniżej. */
const yPlans = createYPlans(yjsStore.doc);

export const newPlanId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function usePlans(): PlanData[] {
  return useSyncExternalStore(yPlans.subscribe, yPlans.list);
}

export function usePlan(pid: string | null): PlanData | null {
  const get = useCallback(() => (pid ? yPlans.get(pid) : null), [pid]);
  return useSyncExternalStore(yPlans.subscribe, get);
}

export const getPlan = (pid: string) => yPlans.get(pid);

/** Nowa analiza z zaimportowanego obrazu; `null` = limit analiz. */
export function createPlan(name: string, image: PlanImage, work?: PlanImage, siteId?: string, now: number = Date.now()): AnalysisProject | null {
  const project: AnalysisProject = {
    id: newPlanId("plan"),
    name,
    ...(siteId ? { siteId } : {}),
    image,
    ...(work ? { work } : {}),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  return yPlans.createProject(project) ? project : null;
}

export const renamePlan = (pid: string, name: string) => yPlans.updateProject(pid, { name });
export const setPlanStatus = (pid: string, status: AnalysisProject["status"]) => yPlans.updateProject(pid, { status });
export const setPlanSite = (pid: string, siteId: string | undefined) => yPlans.updateProject(pid, { siteId });
export const setPlanColors = (pid: string, list: PlanColor[]) => yPlans.setColors(pid, list);
export const setPlanCalibration = (pid: string, cal: PlanCalibration | null) => yPlans.setCalibration(pid, cal);
export const removePlan = (pid: string) => yPlans.removeProject(pid);
export const restorePlan = (entries: PlanEntries) => yPlans.restore(entries);
export const savePlanEntity = yPlans.save;
export const removePlanEntity = <K extends EntityKind>(kind: K, pid: string, id: string) => yPlans.remove(kind, pid, id);

/** „Cofnij”/„Ponów” w edytorze: stan przycisków i akcje. */
const undoSnapshot = { undo: false, redo: false };
let undoState = undoSnapshot;
yPlans.history.subscribe(() => { undoState = { undo: yPlans.history.canUndo(), redo: yPlans.history.canRedo() }; });
export function usePlansUndo(): { undo: boolean; redo: boolean } {
  return useSyncExternalStore(yPlans.history.subscribe, () => undoState);
}
export const undoPlans = () => yPlans.history.undo();
export const redoPlans = () => yPlans.history.redo();
export const clearPlansUndo = () => yPlans.history.clear();
export const stopPlansCapture = () => yPlans.history.stop();

export const plansDump = () => yPlans.dump();
export const mergePlansDump = (raw: unknown) => yPlans.mergeDump(raw);
