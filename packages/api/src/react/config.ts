import { httpBatchStreamLink, loggerLink } from '@trpc/client';
import SuperJSON from 'superjson';
import { env } from '../env';

export const getBaseUrl = (baseUrl?: string) => {
  if (baseUrl) return baseUrl;

  // Check for browser environment (web)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
    const global = globalThis as unknown as { location?: { origin?: string } };
    if (global.location?.origin) {
      return global.location.origin;
    }
  }

  if (env.NEXT_PUBLIC_APP_URL) return env.NEXT_PUBLIC_APP_URL;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;

  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export const createDefaultLinks = ({
  sourceHeader,
  authToken,
  sessionCookie,
  cookieGetter,
  baseUrl,
}: {
  sourceHeader?: string;
  authToken?: string;
  /** Static session cookie value */
  sessionCookie?: string;
  /** Dynamic cookie getter - called on each request (useful for Expo/mobile) */
  cookieGetter?: () => string | undefined;
  baseUrl?: string;
} = {}) => [
  loggerLink({
    enabled: (op) =>
      env.NODE_ENV === 'development' ||
      (op.direction === 'down' && op.result instanceof Error),
  }),
  httpBatchStreamLink({
    headers() {
      const headers = new Headers();
      headers.set('x-trpc-source', sourceHeader ?? 'vanilla');

      if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
      }

      // Support dynamic cookie getter (for Expo) or static cookie
      const cookie = cookieGetter?.() ?? sessionCookie;
      if (cookie) {
        headers.set('Cookie', cookie);
      }

      return headers;
    },
    transformer: SuperJSON,
    url: `${getBaseUrl(baseUrl)}/api/trpc`,
  }),
];

export type ClientConfig = {
  sourceHeader?: string;
  authToken?: string;
  /** Static session cookie value */
  sessionCookie?: string;
  /** Dynamic cookie getter - called on each request (useful for Expo/mobile) */
  cookieGetter?: () => string | undefined;
  baseUrl?: string;
};
