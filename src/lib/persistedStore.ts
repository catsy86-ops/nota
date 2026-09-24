import { useSyncExternalStore } from "react";

export interface PersistedStore<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
  /** Re-notify subscribers without changing the stored value — for state that
   * also depends on something external (e.g. an OS media-query listener). */
  notify(): void;
  use(): T;
}

export interface PersistedStoreOptions<T> {
  /** Combines a freshly-parsed stored value with `defaults` on every read.
   * Defaults to "trust the stored value as-is" — pass a shallow-merge
   * function for Record-shaped settings so keys added later still get a
   * default, or a validator for scalar values restricted to a known set. */
  merge?: (defaults: T, stored: T) => T;
  /** Runs on every `set()` (including the initial read), e.g. to mirror the
   * value onto a DOM attribute. */
  onChange?: (next: T) => void;
}

/**
 * A small localStorage-backed external store, shared as a module-level
 * singleton across every component instance — the same
 * read/listeners/emit/useSyncExternalStore shape this app's settings
 * modules (view prefs, effect toggles, confirm prompts, ...) each used to
 * hand-roll independently.
 */
export function createPersistedStore<T>(
  key: string,
  defaults: T,
  options: PersistedStoreOptions<T> = {},
): PersistedStore<T> {
  const hasCustomMerge = options.merge !== undefined;
  const merge = options.merge ?? ((_defaults, stored) => stored);

  function read(): T {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaults;
      try {
        return merge(defaults, JSON.parse(raw));
      } catch {
        // Backward-compat only: a caller with a validating `merge` (e.g. a
        // scalar store that used to write a bare, non-JSON string) gets a
        // chance to accept the raw value as-is. Without a custom `merge`,
        // unparsable JSON is real corruption — fall back to defaults.
        return hasCustomMerge ? merge(defaults, raw as T) : defaults;
      }
    } catch {
      return defaults;
    }
  }

  let state = read();
  const listeners = new Set<() => void>();

  function emit() {
    listeners.forEach((l) => l());
  }

  function get(): T {
    return state;
  }

  function set(next: T): void {
    state = next;
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* ignore quota */ }
    options.onChange?.(state);
    emit();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  function use(): T {
    return useSyncExternalStore(subscribe, get, () => defaults);
  }

  return { get, set, subscribe, notify: emit, use };
}
