import { useEffect } from "react";

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener?(type: "release", cb: () => void): void;
}
type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
};

/**
 * Trzyma ekran włączony, dopóki `active` (tryb prezentacji, skupienia).
 * Bez API (Safari < 16.4, Firefox) albo przy odmowie systemu — po cichu nic.
 * Przeglądarka sama zwalnia blokadę, gdy karta znika, więc po powrocie
 * (`visibilitychange`) żądamy jej ponownie.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock?.request) return;

    let cancelled = false;
    let sentinel: WakeLockSentinelLike | null = null;

    async function acquire() {
      if (cancelled || sentinel || document.visibilityState !== "visible") return;
      try {
        const s = await nav.wakeLock!.request("screen");
        if (cancelled) {
          void s.release().catch(() => {});
          return;
        }
        sentinel = s;
        s.addEventListener?.("release", () => { if (sentinel === s) sentinel = null; });
      } catch {
        // Niski poziom baterii, tryb oszczędzania — to nie błąd aplikacji.
      }
    }

    const onVisibility = () => { if (document.visibilityState === "visible") void acquire(); };
    document.addEventListener("visibilitychange", onVisibility);
    void acquire();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const s = sentinel;
      sentinel = null;
      void s?.release().catch(() => {});
    };
  }, [active]);
}
