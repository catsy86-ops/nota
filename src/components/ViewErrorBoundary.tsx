import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatusPanel } from "@/components/StatusPanel";
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
    const offline = chunk && typeof navigator !== "undefined" && navigator.onLine === false;
    const reload = (
      <Button size="sm" variant={chunk ? "default" : "outline"} onClick={() => window.location.reload()}>Odśwież stronę</Button>
    );
    if (offline) {
      return (
        <StatusPanel
          tone="offline"
          title={`${this.props.name}: ten widok potrzebuje internetu`}
          description="Nie był jeszcze zapisany na tym urządzeniu. Notatki działają bez sieci — wróć tu po połączeniu i odśwież stronę."
          actions={reload}
        />
      );
    }
    return (
      <StatusPanel
        tone="error"
        title={`${this.props.name}: nie udało się wyświetlić widoku`}
        description={chunk ? "Nie dało się pobrać tej części aplikacji — sprawdź połączenie i odśwież stronę." : "Pozostałe widoki działają. Spróbuj ponownie albo odśwież stronę."}
        actions={<>
          {!chunk && <Button size="sm" onClick={() => this.setState({ error: null })}>Spróbuj ponownie</Button>}
          {reload}
        </>}
      />
    );
  }
}
