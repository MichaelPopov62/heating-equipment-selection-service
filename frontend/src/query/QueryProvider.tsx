/**
 * Назначение: провайдер React Query для приложения.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

import { createAppQueryClient } from './queryClient';

export type QueryProviderProps = {
  children: ReactNode;
};

/**
 * @param props
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
