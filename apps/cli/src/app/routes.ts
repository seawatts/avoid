import { useMemo } from 'react';
import { useAuthStore } from '~/stores/auth-store';
import { useCliStore } from '~/stores/cli-store';
import type { Route } from '~/stores/router-store';
import { DebugPage } from './debug/page';
import { HotkeysPage } from './hotkeys/page';
import { LoginLayout } from './login/layout';
import { LogoutPage } from './logout/page';
import { MenuLayout } from './menu/layout';
import { NotFoundPage } from './not-found/page';
import { QuitPage } from './quit/page';
import { UnauthorizedPage } from './unauthorized/page';

export type AppRoutePath =
  | '/'
  | '/login'
  | '/logout'
  | '/unauthorized'
  | '/docs'
  | '/not-found'
  | '/report-issue'
  | '/quit'
  | '/settings'
  | '/status'
  | '/metrics'
  | '/debug'
  | '/hotkeys'
  | '/help'
  | '/init'
  | '/listen';

// Type for static routes (no parameters)
export type StaticAppRoutePath = Exclude<AppRoutePath, `${string}:${string}`>;

export type AppRoute = Route<AppRoutePath>;

export function useRoutes() {
  const isSignedIn = useAuthStore.use.isSignedIn();
  const isDebug = useCliStore.use.verbose?.();

  return useMemo(() => {
    const authenticatedRoutes: AppRoute[] = [
      {
        path: '/logout',
        component: LogoutPage,
        label: 'Logout',
        hotkey: 'l',
      },
      {
        path: '/listen',
        component: () => null,
        label: 'Listen for Changes',
      },
    ];

    const debugRoute: AppRoute = {
      path: '/debug',
      component: DebugPage,
      label: 'Debug Info',
      hotkey: 'd',
    };

    const unauthenticatedRoutes: AppRoute[] = [
      {
        path: '/login',
        component: LoginLayout,
        label: 'Login',
        hotkey: 'l',
      },
    ];

    const commonRoutes: AppRoute[] = [
      {
        path: '/',
        component: MenuLayout,
        label: 'Menu',
        showInMenu: false,
      },
      {
        path: '/init',
        component: () => null,
        label: 'Initialize Project',
      },
      {
        path: '/hotkeys',
        component: HotkeysPage,
        label: 'Hotkeys',
        showInMenu: false,
        hotkey: '?',
      },
      {
        path: '/help',
        component: () => null,
        label: 'Help',
        hotkey: 'h',
      },
      {
        path: '/report-issue',
        component: () => null,
        label: 'Report Issue',
        hotkey: 'i',
        url: 'https://github.com/acme-sh/acme/issues/new?template=bug_report.yml',
      },
      {
        path: '/docs',
        component: () => null,
        label: 'Docs',
        hotkey: 'd',
        url: 'https://docs.acme.sh',
      },
      {
        path: '/quit',
        component: QuitPage,
        label: 'Quit',
        hotkey: 'q',
      },
      {
        path: '/unauthorized',
        component: UnauthorizedPage,
        label: 'Unauthorized',
        showInMenu: false,
      },
      {
        path: '/not-found',
        component: NotFoundPage,
        label: 'Not Found',
        showInMenu: false,
      },
    ];

    return [
      ...(isSignedIn ? authenticatedRoutes : unauthenticatedRoutes),
      ...(isSignedIn && isDebug ? [debugRoute] : []),
      ...commonRoutes,
    ];
  }, [isSignedIn, isDebug]);
}
