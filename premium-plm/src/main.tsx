import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from './App.tsx'

// Default retry is 3 (exponential backoff) — fine for a flaky request, but
// combined with the 20s request timeout in apiClient.ts, a genuinely dead
// backend could take over a minute to finally show an error. One retry is
// enough to ride out a brief blip without leaving the page looking frozen.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
         <App />
    </QueryClientProvider>
  </StrictMode>,
)
