import type { SortKey } from "@/lib/viewPrefs";
import type { PropDef } from "@/lib/noteProps";

/** Stałe kryteria sortowania; własne pola dochodzą za nimi. */
export const BASE_SORTS: { v: SortKey; label: string }[] = [
  { v: "updated", label: "Data modyfikacji" },
  { v: "created", label: "Data utworzenia" },
  { v: "opened", label: "Ostatnio otwierane" },
  { v: "title", label: "Tytuł (A-Z)" },
  { v: "color", label: "Kolor" },
  { v: "priority", label: "Priorytet" },
  { v: "manual", label: "Ręcznie (przeciągnij)" },
];

/**
 * Opcje „Sortuj wg” dla menu na komputerze i arkusza na telefonie — jedna lista, żeby oba
 * miejsca pokazywały to samo. Pola w kolejności pokazywania, każde jako `prop:<id>`.
 */
export function sortOptions(propDefs: PropDef[]): { v: SortKey; label: string }[] {
  const fields = [...propDefs]
    .sort((a, b) => a.order - b.order)
    .map((d): { v: SortKey; label: string } => ({ v: `prop:${d.id}`, label: d.name }));
  return [...BASE_SORTS, ...fields];
}
