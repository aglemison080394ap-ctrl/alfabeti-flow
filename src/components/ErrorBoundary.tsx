import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Se true, mostra apenas um aviso inline em vez de tomar a tela toda */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorCount: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log detalhado para debug — nunca propaga para cima
    console.error('[ErrorBoundary] Erro capturado:', error.message);
    console.error('[ErrorBoundary] Componente:', info.componentStack?.split('\n')[1]?.trim() ?? 'desconhecido');
  }

  handleReset = () => {
    this.setState(s => ({ hasError: false, error: undefined, errorCount: s.errorCount + 1 }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (this.props.inline) {
        return (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm my-2">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <p className="font-medium">Erro ao carregar este componente</p>
              {this.state.error?.message && (
                <p className="text-xs opacity-70 mt-0.5 font-mono">{this.state.error.message}</p>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="px-3 py-1.5 bg-destructive/20 hover:bg-destructive/30 rounded-lg text-xs font-medium transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center bg-background">
          <div className="text-center space-y-4 max-w-md p-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Algo deu errado</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Ocorreu um erro inesperado nesta seção. As outras partes do sistema continuam funcionando normalmente.
              </p>
              {this.state.error?.message && (
                <p className="text-xs text-muted-foreground/60 mt-2 font-mono bg-muted p-2 rounded-lg break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
