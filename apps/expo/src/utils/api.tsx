import type { AppRouter } from '@seawatts/api';
import { createClient } from '@seawatts/api';
import { QueryClient } from '@tanstack/react-query';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';

import { authClient } from './auth';
import { getApiBaseUrl } from './base-url';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Configure default query options here
    },
  },
});

/**
 * Vanilla tRPC client for imperative calls (non-React context).
 * Use this for mutations outside of React components.
 *
 * Uses cookieGetter for dynamic auth - the cookie is fetched on each request
 * since it may change after OAuth login.
 */
export const api = createClient({
  baseUrl: getApiBaseUrl(),
  cookieGetter: () => authClient.getCookie() ?? undefined,
  sourceHeader: 'expo',
});

/**
 * A set of typesafe hooks for consuming your API.
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: api,
  queryClient,
});

export type { RouterInputs, RouterOutputs } from '@seawatts/api';
