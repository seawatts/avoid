import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { getAuthBaseUrl } from './base-url';

// Get the actual scheme from app.config.ts
const configScheme = Constants.expoConfig?.scheme;
const scheme = Array.isArray(configScheme)
  ? configScheme[0]
  : (configScheme ?? 'startuptemplate');

export const authClient = createAuthClient({
  baseURL: getAuthBaseUrl(),
  plugins: [
    expoClient({
      scheme,
      storage: SecureStore,
      storagePrefix: 'startuptemplate',
    }),
  ],
});
