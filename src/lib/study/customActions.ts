import { toastWithUndo } from "@/lib/undoToast";
import { removeCustomEntry, restoreCustomEntry } from "./store";
import type { CustomEntry } from "./custom";

/** Usuwa własny wpis i pokazuje „Cofnij”, które przywraca go z tym samym id (powtórki nie wracają). */
export function deleteCustom(entry: CustomEntry, label: string) {
  removeCustomEntry(entry.id);
  toastWithUndo(`Usunięto „${label}”`, () => restoreCustomEntry(entry), { id: `custom-${entry.id}` });
}
