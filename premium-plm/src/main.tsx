import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from './App.tsx'
import { ApiError } from "./apicalls/apiClient";

// Default retry is 3 (exponential backoff) — fine for a flaky request, but
// combined with the 20s request timeout in apiClient.ts, a genuinely dead
// backend could take over a minute to finally show an error. One retry is
// enough to ride out a brief blip without leaving the page looking frozen.
// A 4xx (not found, forbidden, bad request…) is the server's real answer,
// so asking again would only repeat the same failed request — never retried.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data fetched in the last 30s is reused instead of fetched again when
      // another part of the page (or the next page) asks for the same thing.
      // Saves, submits and decisions refresh what they change straight away
      // (invalidateQueries), so this never shows stale results after an action.
      staleTime: 30_000,
      // React Query re-fetches every query on the page whenever the window
      // regains focus (switching tabs, clicking back from DevTools…). That
      // re-sent the same requests over and over while someone was simply
      // working, so it's off: data refreshes when a page opens and after any
      // save, submit or decision, which is when it can actually change.
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }

        return failureCount < 1;
      },
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
