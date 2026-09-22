/**
 * Centralised formatting for the "trash auto-delete countdown" badge.
 *
 * Adding a new language = add an entry to LABELS below. The shape mirrors
 * Intl.PluralRules categories ("zero", "one", "few", "many", "other") so the
 * formatter can pick the correct variant per locale without changing call sites.
 */

export type TrashCountdownLocale = "pl" | "en";

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

interface LocaleLabels {
  /** Used when days === 0 (delete happens today). */
  today: string;
  /** Used when days === 1 (delete happens tomorrow). */
  tomorrow: string;
  /**
   * Used when days >= 2. Use `{days}` as the placeholder.
   * Provide the plural forms required by the locale.
   */
  inDays: PluralForms;
}

const LABELS: Record<TrashCountdownLocale, LocaleLabels> = {
  pl: {
    today: "Usunięcie dzisiaj",
    tomorrow: "Zostanie usunięta jutro",
    inDays: {
      few: "Usunięcie za {days} dni",
      many: "Usunięcie za {days} dni",
      other: "Usunięcie za {days} dni",
    },
  },
  en: {
    today: "Deletes today",
    tomorrow: "Deletes tomorrow",
    inDays: {
      one: "Deletes in {days} day",
      other: "Deletes in {days} days",
    },
  },
};

const pluralCache = new Map<TrashCountdownLocale, Intl.PluralRules>();
function getPluralRules(locale: TrashCountdownLocale): Intl.PluralRules {
  let rules = pluralCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralCache.set(locale, rules);
  }
  return rules;
}

/**
 * Format the countdown badge label for the given number of days.
 * Single source of truth for the badge text — extend LABELS to add a language.
 */
export function formatTrashCountdownLabel(days: number, locale: TrashCountdownLocale = "pl"): string {
  const labels = LABELS[locale] ?? LABELS.pl;
  if (days <= 0) return labels.today;
  if (days === 1) return labels.tomorrow;

  const category = getPluralRules(locale).select(days) as Intl.LDMLPluralRule;
  const template = labels.inDays[category] ?? labels.inDays.other;
  return template.replace("{days}", String(days));
}
