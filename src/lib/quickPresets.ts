/** Otwiera okienko szybkich zestawów wyglądu (`QuickPresetsHost`) z dowolnego miejsca. */
export const QUICK_PRESETS_EVENT = "kaczy:quick-presets";
export const openQuickPresets = () => window.dispatchEvent(new CustomEvent(QUICK_PRESETS_EVENT));
