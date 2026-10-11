import { createPersistedStore } from "@/lib/persistedStore";

/** Własny szablon notatki: tytuł i treść mogą zawierać zmienne (`lib/templateVars.ts`). */
export interface CustomTemplate {
  id: string;
  name: string;
  emoji: string;
  title: string;
  content: string;
  labels: string[];
}

export const MAX_CUSTOM_TEMPLATES = 20;

function sanitize(list: unknown): CustomTemplate[] {
  if (!Array.isArray(list)) return [];
  const out: CustomTemplate[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Partial<CustomTemplate>;
    if (typeof t.id !== "string" || typeof t.name !== "string" || !t.name.trim()) continue;
    out.push({
      id: t.id,
      name: t.name.slice(0, 40),
      emoji: typeof t.emoji === "string" ? t.emoji.slice(0, 8) : "",
      title: typeof t.title === "string" ? t.title.slice(0, 200) : "",
      content: typeof t.content === "string" ? t.content.slice(0, 20000) : "",
      labels: Array.isArray(t.labels) ? t.labels.filter((l): l is string => typeof l === "string").slice(0, 10) : [],
    });
    if (out.length >= MAX_CUSTOM_TEMPLATES) break;
  }
  return out;
}

const store = createPersistedStore<CustomTemplate[]>("kaczy.templates.v1", [], {
  merge: (defaults, stored) => (Array.isArray(stored) ? sanitize(stored) : defaults),
});

export function useCustomTemplates(): CustomTemplate[] {
  return store.use();
}

export function getCustomTemplates(): CustomTemplate[] {
  return store.get();
}

/** Dodaje albo podmienia (po `id`) szablon. Zwraca `false`, gdy limit jest wyczerpany. */
export function saveCustomTemplate(t: CustomTemplate): boolean {
  const list = store.get();
  const exists = list.some((x) => x.id === t.id);
  if (!exists && list.length >= MAX_CUSTOM_TEMPLATES) return false;
  const [clean] = sanitize([t]);
  if (!clean) return false;
  store.set(exists ? list.map((x) => (x.id === t.id ? clean : x)) : [...list, clean]);
  return true;
}

export function deleteCustomTemplate(id: string) {
  store.set(store.get().filter((t) => t.id !== id));
}
