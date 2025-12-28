import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

// Auth must go through production URL because:
// 1. Mobile devices can't reach localhost
// 2. OAuth callbacks are registered with production URL in Google Console
// 3. The oAuthProxy plugin on the server handles the rest
const AUTH_URL = 'https://startup-template-mu.vercel.app';

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [
    expoClient({
      scheme: 'expo',
      storage: SecureStore,
      storagePrefix: 'expo',
    }),
  ],
});
