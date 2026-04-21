import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log clear error info for debugging
    console.error('[ErrorBoundary] Captured error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Algo deu errado
            </h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página. Se o problema continuar, contate o administrador.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-muted-foreground/70 bg-muted p-3 rounded-lg break-all font-mono">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={this.handleReset}>
                Tentar novamente
              </Button>
              <Button className="flex-1 gap-2" onClick={this.handleReload}>
                <RefreshCw className="w-4 h-4" />
                Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
