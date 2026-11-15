/**
 * Jedyne miejsce w `src/lib`, które zna bibliotekę dymków (`sonner`).
 * Pozostałe moduły `lib` importują `toast` stąd — wymiana albo wstrzyknięcie ujścia (plan A1.4)
 * będzie zmianą jednego pliku. `vi.mock("sonner")` w testach nadal przechwytuje wywołania.
 */
export { toast } from "sonner";
