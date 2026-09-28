// Skróty obsługują i Ctrl, i ⌘ (useGlobalShortcuts) — tu tylko dobór podpisu do platformy.
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform || navigator.platform || navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** „⌘” na Macu/iOS, „Ctrl” wszędzie indziej. */
export const MOD_KEY = isApplePlatform() ? "⌘" : "Ctrl";

/** Skrót z klawiszem modyfikującym, np. `modShortcut("K")` → „Ctrl+K” albo „⌘K”. */
export function modShortcut(key: string): string {
  return MOD_KEY === "⌘" ? `⌘${key}` : `Ctrl+${key}`;
}
