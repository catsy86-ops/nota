/** Pierwszy cykl nowego grafiku (G4.2): bez cyklu albo dniówka pn–pt od dziś. Kroki to id rodzajów z `DEFAULT_SHIFT_TYPES`. */
export const FIRST_CYCLES = {
  none: { label: "Bez cyklu — zaczniesz od pustej siatki", steps: null },
  weekdays: { label: "Dniówka 8–16 od poniedziałku do piątku, od dziś na 4 tygodnie", steps: ["e", "e", "e", "e", "e", null, null] },
} as const;
export type FirstCycle = keyof typeof FIRST_CYCLES;
export const CYCLE_LENGTH_DAYS = 28;
