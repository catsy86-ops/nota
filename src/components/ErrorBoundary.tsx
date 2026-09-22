import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    if (!confirm("Wyczyścić lokalne dane KACZY i odświeżyć? Notatki zostaną usunięte z tej przeglądarki.")) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("kaczy") || k.startsWith("dash-notes"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-6 shadow-lg text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-display font-bold">Coś poszło nie tak 🦆</h1>
            <p className="text-sm text-muted-foreground">
              Aplikacja napotkała nieoczekiwany błąd. Spróbuj ponownie lub odśwież stronę.
            </p>
          </div>
          {this.state.error.message && (
            <pre className="text-left text-[11px] bg-muted/50 rounded-md p-2 overflow-auto max-h-32 text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex flex-col gap-2">
            <Button onClick={this.handleReset} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Spróbuj ponownie
            </Button>
            <Button onClick={this.handleReload} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" /> Odśwież stronę
            </Button>
            <Button onClick={this.handleClearAndReload} variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" /> Wyczyść dane lokalne i odśwież
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
