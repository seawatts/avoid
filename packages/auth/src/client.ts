'use client';

import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

// Export commonly used hooks and functions
export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  // Organization hooks - generated from the organizationClient plugin
  useActiveOrganization,
  useListOrganizations,
} = authClient;

// Organization actions
export const { organization } = authClient;

// Helper components for conditional rendering
export function useIsAuthenticated() {
  const { data: session, isPending } = useSession();
  return {
    isAuthenticated: !!session?.user,
    isPending,
    session,
    user: session?.user,
  };
}

// Sign in with Google helper
export function signInWithGoogle(options?: { callbackURL?: string }) {
  return signIn.social({
    callbackURL: options?.callbackURL ?? '/app',
    provider: 'google',
  });
}
