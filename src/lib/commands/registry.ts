import type { Command, CommandContext, CommandSource } from "./types";

export type { Command, CommandContext, CommandSource, GoView } from "./types";

/** A3.4: źródła poleceń zgłoszone przez działy. Kolejność wpisu nie ma znaczenia — grupy sortuje `order`. */
const sources: CommandSource[] = [];

/** Dopisuje źródło; zwraca funkcję wycofania (testy, moduły ładowane leniwie). Zduplikowane id polecenia to błąd. */
export function registerCommandSource(source: CommandSource): () => void {
  const known = new Set(sources.flatMap((s) => s.commands.map((c) => c.id)));
  for (const c of source.commands) if (known.has(c.id)) throw new Error(`polecenie ${c.id} już jest w rejestrze`);
  sources.push(source);
  return () => { const i = sources.indexOf(source); if (i >= 0) sources.splice(i, 1); };
}

export const resolveLabel = (c: Command, ctx: CommandContext) => (typeof c.label === "function" ? c.label(ctx) : c.label);
export const resolveShortcut = (c: Command) => c.shortcut?.();
/** Etykieta bez kontekstu (ściąga): napis albo `null`, gdy zależy od stanu palety. */
export const staticLabel = (c: Command) => (typeof c.label === "string" ? c.label : null);
export const groupName = (s: CommandSource) => (typeof s.group === "function" ? s.group() : s.group);

export interface ResolvedGroup {
  heading: string;
  mutedIcons: boolean;
  commands: Command[];
}

/** Grupy do pokazania w kontekście: tylko polecenia z `when` spełnionym, puste grupy pomijane. */
export function commandGroups(ctx: CommandContext): ResolvedGroup[] {
  return [...sources]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ heading: groupName(s), mutedIcons: !!s.mutedIcons, commands: s.commands.filter((c) => !c.when || c.when(ctx)) }))
    .filter((g) => g.commands.length > 0);
}

/** Wszystkie polecenia ze skrótem — bez `when`, bo ściąga pokazuje całość. */
export function commandsWithShortcuts(): { group: string; command: Command }[] {
  return [...sources].sort((a, b) => a.order - b.order).flatMap((s) => s.commands.filter((c) => c.shortcut).map((command) => ({ group: groupName(s), command })));
}

/** Q5.2: grupy poleceń do ściągi `?` — bez `when` i bez grup z `cheatSheet: false`; tylko etykiety stałe. */
export function cheatSheetGroups(): { heading: string; items: { id: string; label: string; shortcut?: string }[] }[] {
  return [...sources]
    .filter((s) => s.cheatSheet !== false)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      heading: groupName(s),
      items: s.commands.flatMap((c) => { const label = staticLabel(c); return label ? [{ id: c.id, label, shortcut: resolveShortcut(c) }] : []; }),
    }))
    .filter((g) => g.items.length > 0);
}
