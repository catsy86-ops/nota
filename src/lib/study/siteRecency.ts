import type { SiteInfo } from "./sites";

/** Budowy do wyboru na ekranie „Budowa”: bez archiwalnych, od ostatnio używanej (wpis albo założenie karty). */
export function activeSitesByRecency(dir: readonly SiteInfo[], journal: readonly { siteId?: string; site: string; at: number }[]): SiteInfo[] {
  const byName = new Map(dir.map((s) => [s.name, s.id] as const));
  const last = new Map<string, number>();
  for (const e of journal) {
    const id = e.siteId ?? byName.get(e.site);
    if (id && (last.get(id) ?? 0) < e.at) last.set(id, e.at);
  }
  return dir
    .filter((s) => s.archived === undefined)
    .sort((a, b) => (last.get(b.id) ?? b.created) - (last.get(a.id) ?? a.created));
}
