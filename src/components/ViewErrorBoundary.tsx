import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logDiag } from "@/lib/diagnostics";

interface Props {
  /** Nazwa widoku w komunikacie i dzienniku, np. „Grafik”. */
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Granica błędu jednego widoku (Grafik, Kalendarz). Awaria albo
 * nieudane doładowanie chunku offline zostaje w tym widoku — nagłówek,
 * nawigacja i notatki działają dalej.
 */
export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logDiag("error", "view", `${this.props.name}: ${info.componentStack?.split("\n")[1]?.trim() ?? ""}`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // `lazy` pamięta odrzucony import, więc po błędzie ładowania pomaga tylko odświeżenie.
    const chunk = /dynamically imported module|Loading chunk|Failed to fetch/i.test(this.state.error.message);
    return (
      <div role="alert" className="rounded-3xl border border-border/60 bg-card p-5 flex gap-4 items-start">
        <TriangleAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-3 min-w-0">
          <div className="space-y-1">
            <p className="font-display font-bold">{this.props.name}: nie udało się wyświetlić widoku</p>
            <p className="text-sm text-muted-foreground">
              {chunk ? "Nie dało się pobrać tej części aplikacji — sprawdź połączenie i odśwież stronę." : "Pozostałe widoki działają. Spróbuj ponownie albo odśwież stronę."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!chunk && <Button size="sm" onClick={() => this.setState({ error: null })}>Spróbuj ponownie</Button>}
            <Button size="sm" variant={chunk ? "default" : "outline"} onClick={() => window.location.reload()}>Odśwież stronę</Button>
          </div>
        </div>
      </div>
    );
  }
}
