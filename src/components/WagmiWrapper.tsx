import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmiConfig';

// Create a separate query client for wagmi to avoid conflicts
const wagmiQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

interface WagmiWrapperProps {
  children: React.ReactNode;
}

export function WagmiWrapper({ children }: WagmiWrapperProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={wagmiQueryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
