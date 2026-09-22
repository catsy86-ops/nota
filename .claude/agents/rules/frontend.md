---
paths:
  - "src/features/**"
  - "src/components/**"
  - "src/hooks/**"
  - "src/store/**"
description: "Frontend rules"
---

## Zasady

- Funkcyjne komponenty + hooks (brak class components)
- TypeScript strict — brak `any`
- Każdy komponent ma co-located test: `Button.tsx` → `Button.test.tsx`
- Nie twórz komponentu abstrakcyjnego, jeśli jest używany w < 2 miejscach
- Nie importuj z `src/api/` bezpośrednio w komponentach — zawsze przez hook (`useFetch`, `useMutation`)

## State Management (Zustand)

- Store per feature: `src/features/budget/store.ts`
- Nie twórz jednego globalnego store
- Selektory: `useBudgetStore((s) => s.categories)` — nie `useBudgetStore()` (re-render na każdą zmianę)
- Async actions w store: `async fetchBudget() { ... }` z try/catch

## API Calls

- Centralny client: `src/utils/api.ts` (fetch wrapper z JWT refresh, error handling)
- Każdy endpoint zwraca typed response: `api.get<BudgetResponse>('/budgets')`
- Error handling: `try/catch` w hook, nie w komponencie
- Loading state: `isLoading`, `error` — NIGDY nie rzucaj do UI bez catch

## Styling (Tailwind)

- Nie używaj inline styles (`style={{}}`) — tylko Tailwind classes
- Nie twórz custom CSS plików — jeśli czegoś brakuje w Tailwind, użyj `@apply` w `globals.css`
- Dark mode: `dark:` prefix (nie osobny plik CSS)
- Responsive: mobile-first (`sm:`, `md:`, `lg:`)

## Formularze

- Walidacja: React Hook Form + Zod (ten sam schema co backend — `src/schemas/`)
- Nie waliduj w `onChange` — waliduj na submit + `onBlur`
- Error message pod polem, nie w toasts (toasts tylko dla API errors)
- Disable submit button podczas `isSubmitting`

## Wykresy (Recharts)

- Każdy wykres ma `aria-label` z opisem
- Responsive: `ResponsiveContainer` (nie hardcoded width/height)
- Dane: przelicz w hooku (`useBudgetChartData`), nie w renderze
- Kolory: z `src/theme/colors.ts` (nie hex w komponentach)

## Listy i Pagination

- Każda lista ma skeleton loader (nie spinner)
- Pagination: cursor-based (nie offset)
- Virtual scrolling (react-window) przy > 50 itemach
- Nie renderuj > 100 itemów bez pagination/virtualization

## Obrazy paragonów

- Thumbnail: `loading="lazy"`, `srcset` (48px, 96px, 192px)
- Full: modal z `useEffect` cleanup (zamknij na Escape)
- Nie renderuj pełnego obrazu w liście — tylko thumbnail

## Dark Mode

- Toggle w settings (system / light / dark)
- Przechowuj w `localStorage` + sync z `prefers-color-scheme`
- Testy: renderuj w obu trybach (jest-extended: `setTheme`)

## Performance

- `React.memo` tylko gdy profile pokazuje waste (nie profilaktycznie)
- `useMemo` / `useCallback` tylko dla expensive calculations
- Code splitting: `React.lazy()` per feature (nie per komponent)
-

## Struktura folderu per feature

- src/features/budget/
- components/ # tylko komponenty UI tego feature
- hooks/ # useBudget, useCategories
- api.ts # endpointy tego feature (jedyny plik z fetch)
- types.ts # typy specyficzne dla feature
- index.ts # public API (export co inne feature mogą importować)
