import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

/** Single ref passed to `NavigationContainer` in `index.js`. */
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

/**
 * Navigate into the Activities tab stack (customer + vendor share these screen names).
 * @param {string} screen e.g. 'Order-detail' | 'Dispute-detail' | 'Return-detail' | 'Inbox'
 * @param {Record<string, unknown>} [params]
 */
export function navigateToActivitiesScreen(screen, params) {
  if (!navigationRef.isReady()) return false;
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'home',
      params: {
        screen: 'Activities',
        params: {
          screen,
          params,
        },
      },
    }),
  );
  return true;
}
