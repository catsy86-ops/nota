import { createPersistedStore } from "@/lib/persistedStore";
import { contrastRatio, formatOklch, parseOklch, type Oklch } from "@/lib/oklch";
import { isSkin, skinStore } from "@/lib/skins";
import type { Skin } from "@/lib/skinList";

/**
 * Własny motyw (plan motywów 4.1, decyzja T-4): styl bazowy i trzy suwaki odcienia (0–359°) — papier,
 * kafel i akcent. Bez HEX. Jasność i nasycenie bierze generator z bazy stylu; gdy odcień psuje
 * kontrast tekstu (WCAG AA, 4,5:1), szuka najbliższej jasności, która przechodzi, a jeśli żadna
 * nie przechodzi, zostaje kolor bazowy tego tokenu. Motyw dotyczy tylko stylu, z którego powstał.
 * Zapis per urządzenie w `kaczy.customTheme.v1`; stosowany jako styl `html` po każdym malowaniu
 * (`applyCustomTheme`, wołane z `useTheme.ts`).
 */
export type Group = "paper" | "tile" | "accent";

export interface CustomTheme {
  skin: Skin;
  /** Odcień 0–359 dla każdej grupy. */
  hues: Record<Group, number>;
}

/** Grupa → token CSS, który zmienia, i pary tekst/tło, które musi utrzymać. */
const GROUPS: Record<Group, { token: string; pairs: [string, string][]; minChroma: number }> = {
  paper: {
    token: "background",
    pairs: [["foreground", "background"], ["muted-foreground", "background"], ["destructive-ink", "background"]],
    minChroma: 0.025,
  },
  tile: {
    token: "card",
    pairs: [["foreground", "card"], ["muted-foreground", "card"], ["destructive-ink", "card"]],
    minChroma: 0.02,
  },
  accent: {
    token: "primary",
    pairs: [["primary-foreground", "primary"]],
    minChroma: 0.14,
  },
};

export const GROUP_LABEL: Record<Group, string> = { paper: "Papier", tile: "Kafel", accent: "Akcent" };

const MIN_CONTRAST = 4.5;
/** Krok szukania jasności i największe odchylenie od bazy (L w skali OKLCH). */
const L_STEP = 0.01;
const L_RANGE = 0.35;

export type Tokens = Record<string, Oklch>;

const pairsPass = (t: Tokens, pairs: [string, string][]) =>
  pairs.every(([fg, bg]) => t[fg] && t[bg] && contrastRatio(t[fg], t[bg]) >= MIN_CONTRAST);

/**
 * Tokeny z nowym odcieniem. `failing` to grupy, których nie udało się ustawić (zostają bazowe).
 * Czysta funkcja: testy i podgląd dostają te same wyniki.
 */
export function generate(base: Tokens, hues: Record<Group, number>): { tokens: Tokens; failing: Group[] } {
  const out: Tokens = { ...base };
  const failing: Group[] = [];
  for (const group of Object.keys(GROUPS) as Group[]) {
    const { token, pairs, minChroma } = GROUPS[group];
    const b = base[token];
    if (!b) { failing.push(group); continue; }
    const [L, C] = b;
    const chroma = Math.max(C, minChroma);
    const withL = (l: number): Oklch => [l, chroma, hues[group]];
    const candidates: number[] = [0];
    for (let d = L_STEP; d <= L_RANGE + 1e-9; d += L_STEP) candidates.push(d, -d);
    let found: Oklch | null = null;
    for (const d of candidates) {
      const l = L + d;
      if (l < 0 || l > 1) continue;
      const cand = withL(l);
      if (pairsPass({ ...out, [token]: cand }, pairs)) { found = cand; break; }
    }
    if (found) out[token] = found;
    else failing.push(group);
  }
  return { tokens: out, failing };
}

const isHue = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 359;

function isTheme(v: unknown): v is CustomTheme {
  if (!v || typeof v !== "object") return false;
  const t = v as Partial<CustomTheme>;
  return isSkin(t.skin) && !!t.hues && isHue(t.hues.paper) && isHue(t.hues.tile) && isHue(t.hues.accent);
}

export const customThemeStore = createPersistedStore<CustomTheme | null>("kaczy.customTheme.v1", null, {
  merge: (defaults, stored) => (isTheme(stored) ? stored : defaults),
});
// Po zapisie (także z innej karty) od razu przeliczyć tokeny; osobno, nie w `onChange`, bo ten
// odpala się już przy pierwszym odczycie, zanim stała jest przypisana.
customThemeStore.subscribe(() => applyCustomTheme());

export const useCustomTheme = () => customThemeStore.use();

export function setCustomTheme(theme: CustomTheme | null) {
  customThemeStore.set(theme);
}

/** Zmienne CSS, które nadpisuje motyw (inline na `html`, więc wygrywają z plikami stylów w obu schematach). */
const VARS: Record<Group, string> = { paper: "--background", tile: "--card", accent: "--primary" };
const TOKENS_NEEDED = ["foreground", "muted-foreground", "destructive-ink", "primary-foreground", "background", "card", "primary"];

/** Tokeny bieżącego malowania (po `applyCustomTheme` mogą być już nadpisane — dlatego czyta się je po wyczyszczeniu). */
export function readBaseTokens(style: CSSStyleDeclaration): Tokens {
  const out: Tokens = {};
  for (const name of TOKENS_NEEDED) {
    const parsed = parseOklch(style.getPropertyValue(`--${name}`).trim());
    if (parsed) out[name] = parsed;
  }
  return out;
}

/** Odcienie wyjściowe motywu dla stylu: barwy bazowe, żeby suwaki zaczynały od tego, co widać. */
export function baseHues(root: HTMLElement = document.documentElement): Record<Group, number> {
  const base = readBaseTokens(getComputedStyle(root));
  const hueOf = (token: string) => Math.round(base[token]?.[2] ?? 0) % 360;
  return { paper: hueOf(GROUPS.paper.token), tile: hueOf(GROUPS.tile.token), accent: hueOf(GROUPS.accent.token) };
}

/**
 * Nakłada motyw na `html` dla bieżącego stylu i schematu. Wywoływane po każdym malowaniu motywu, więc
 * zmiana stylu lub jasności przelicza tokeny na nowo. Bez motywu albo przy innym stylu zdejmuje
 * poprzednie nadpisania. Zwraca grupy, które nie przeszły kontrastu.
 */
let lastFailing: Group[] = [];

/** Grupy, które w ostatnim przeliczeniu nie przeszły kontrastu (dla komunikatu w Ustawieniach). */
export const customThemeFailing = (): Group[] => lastFailing;

export function applyCustomTheme(root: HTMLElement | null = typeof document === "undefined" ? null : document.documentElement, skin: Skin = skinStore.get()): Group[] {
  if (!root) return [];
  for (const v of Object.values(VARS)) root.style.removeProperty(v);
  const theme = customThemeStore.get();
  lastFailing = [];
  if (!theme || theme.skin !== skin) return lastFailing;
  const base = readBaseTokens(getComputedStyle(root));
  const { tokens, failing } = generate(base, theme.hues);
  for (const group of Object.keys(GROUPS) as Group[]) {
    if (failing.includes(group)) continue;
    root.style.setProperty(VARS[group], formatOklch(tokens[GROUPS[group].token]));
  }
  lastFailing = failing;
  return failing;
}
