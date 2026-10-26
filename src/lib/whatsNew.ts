import { createPersistedStore } from "@/lib/persistedStore";

/** Ostatnio widziana wersja (per urządzenie). `null` = pierwsze uruchomienie. */
export const lastSeenVersionStore = createPersistedStore<string | null>("kaczy.lastSeenVersion.v1", null, {
  merge: (defaults, stored) => (typeof stored === "string" && stored.length <= 32 ? stored : defaults),
});

/**
 * Czy pokazać „Co nowego”: tylko po zmianie wersji. Pierwsze uruchomienie zapamiętuje wersję bez dymka,
 * żeby nowa instalacja nie witała listą zmian.
 */
export function whatsNewDecision(lastSeen: string | null, current: string): "remember" | "show" | "none" {
  if (lastSeen === null) return "remember";
  return lastSeen === current ? "none" : "show";
}
