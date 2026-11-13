import { memo, useMemo } from "react";
import { useClients } from "@/lib/clients/store";

/** Podpowiedzi nazw klientów dla pola „Inwestor” (`<input list={id}>`); archiwalnych nie pokazuje. Nie renderuje się przy pisaniu w polu. */
export const ClientDatalist = memo(function ClientDatalist({ id }: { id: string }) {
  const clients = useClients();
  const options = useMemo(() => clients.filter((c) => !c.archived).map((c) => <option key={c.id} value={c.name} />), [clients]);
  return <datalist id={id}>{options}</datalist>;
});
