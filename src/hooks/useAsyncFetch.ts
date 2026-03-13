import { useState, useCallback, useRef } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Wrapper seguro para fetches assíncronos.
 * - Evita setState em componentes desmontados
 * - Captura todos os erros e expõe estado de erro local (não derruba o app)
 * - Retorna `execute` para disparar o fetch manualmente
 */
export function useAsyncFetch<T>(
  fetcher: () => Promise<T>
): FetchState<T> & { execute: () => Promise<void>; reset: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: false, error: null });
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido ao carregar dados.';
        setState({ data: null, loading: false, error: message });
        console.error('[useAsyncFetch]', err);
      }
    }
  }, [fetcher]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
