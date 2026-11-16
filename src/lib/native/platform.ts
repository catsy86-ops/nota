/**
 * Czy aplikacja działa w powłoce Capacitora (APK na Androidzie), a nie w przeglądarce.
 * Most natywny wstawia `window.Capacitor` przed wczytaniem strony, więc sprawdzamy sam obiekt —
 * bez importu `@capacitor/core`, który inaczej wszedłby do paczki startowej PWA.
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: CapacitorGlobal }).Capacitor;
  try {
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
