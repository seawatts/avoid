'use client';

import { useSession } from '@seawatts/auth/client';
import posthog from 'posthog-js';
import { useEffect, useRef } from 'react';

export function PostHogIdentifyUser() {
  const { data: session } = useSession();
  const user = session?.user;
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (user) {
      // Only identify if the user ID has changed
      if (previousUserId.current !== user.id) {
        posthog.identify(user.id, {
          email: user.email,
          name: user.name,
        });
        previousUserId.current = user.id;
      }
    } else if (previousUserId.current && !user) {
      // User was previously identified but is now undefined
      // Don't automatically track this as a sign out event
      // Only track when explicitly called via signOut()
      previousUserId.current = null;
    }
  }, [user]);

  return null;
}
