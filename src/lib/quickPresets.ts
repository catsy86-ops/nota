import { SIGNALS } from "@/lib/storage/names";
/** Otwiera okienko szybkich zestawów wyglądu (`QuickPresetsHost`) z dowolnego miejsca. */
export const QUICK_PRESETS_EVENT = SIGNALS.quickPresets;
export const openQuickPresets = () => window.dispatchEvent(new CustomEvent(QUICK_PRESETS_EVENT));
