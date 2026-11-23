/**
 * D6.2: pliki z literałem klucza `"kaczy.`/`"kaczy:` poza rejestrem (`keys.ts`). Lista tylko maleje — pilnuje tego
 * `keyLiterals.test.ts`. Przeniesione wszystkie działy (2026-11-23); zostaje opis migracji, w którym nazwa klucza jest
 * tekstem dla człowieka (pole `where`), nie użyciem.
 */
export const KEY_LITERAL_EXEMPT: readonly string[] = [
  "src/lib/migrations/registry.ts",
];
