import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { getBaseUrl } from './base-url';

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [
    expoClient({
      scheme: 'startup-template',
      storage: SecureStore,
      storagePrefix: 'startup-template',
    }),
  ],
});
