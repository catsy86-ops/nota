export type Season = "spring" | "summer" | "autumn" | "winter";

export interface SeasonInfo {
  season: Season;
  emoji: string;
  label: string;
  /** Single emoji used as the falling particle */
  particle: string;
  accentHsl: string;
}

export function getCurrentSeason(date = new Date()): SeasonInfo {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return { season: "spring", emoji: "🌸", label: "Wiosna", particle: "🌸", accentHsl: "330 80% 75%" };
  if (m >= 6 && m <= 8) return { season: "summer", emoji: "☀️", label: "Lato", particle: "🌿", accentHsl: "45 90% 60%" };
  if (m >= 9 && m <= 11) return { season: "autumn", emoji: "🍂", label: "Jesień", particle: "🍁", accentHsl: "25 80% 55%" };
  return { season: "winter", emoji: "❄️", label: "Zima", particle: "❄️", accentHsl: "200 70% 70%" };
}
