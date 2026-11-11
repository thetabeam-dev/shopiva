import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

/** Single ref passed to `NavigationContainer` in `index.js`. */
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

function withTabSelected(route, tabName, nestedScreen) {
  const tabState = route.state;
  const tabRoutes = tabState?.routes;
  if (!Array.isArray(tabRoutes) || !tabRoutes.length) {
    return {
      ...route,
      state: {
        index: 0,
        routes: [{ name: tabName, state: { index: 0, routes: [{ name: nestedScreen }] } }],
      },
    };
  }
  const tabIndex = tabRoutes.findIndex((item) => item.name === tabName);
  if (tabIndex < 0) return null;
  const nextTabs = tabRoutes.map((item, index) => {
    if (index !== tabIndex) return item;
    return {
      ...item,
      state: {
        index: 0,
        routes: [{ name: nestedScreen }],
      },
    };
  });
  return {
    ...route,
    state: {
      ...tabState,
      index: tabIndex,
      routes: nextTabs,
    },
  };
}

/** Open the customer Cart tab (nested stack screen `Cart`). */
export function navigateToCartTab() {
  return false;
  /*
  if (!navigationRef.isReady()) return false;

  const root = navigationRef.getRootState();
  const homeIndex = root.routes.findIndex((route) => route.name === 'home');
  if (homeIndex < 0) return false;

  const nextHome = withTabSelected(root.routes[homeIndex], 'Cart', 'Cart');
  if (!nextHome) {
    navigationRef.navigate('home', {
      screen: 'Cart',
      initial: false,
      params: { screen: 'Cart', initial: false },
    });
    return true;
  }

  navigationRef.dispatch(
    CommonActions.reset({
      ...root,
      index: homeIndex,
      routes: root.routes.map((route, index) => (index === homeIndex ? nextHome : route)),
    }),
  );
  return true;
  */
}

export function navigateToActivitiesScreen(screen, params) {
  if (!navigationRef.isReady()) return false;
  const withHub = screen && screen !== 'Activities';
  const routes = withHub
    ? [{ name: 'Activities' }, { name: screen, params }]
    : [{ name: 'Activities' }];
  navigationRef.dispatch(
    CommonActions.navigate({
      name: 'home',
      params: {
        screen: 'Activities',
        params: {
          state: {
            index: routes.length - 1,
            routes,
          },
        },
      },
    }),
  );
  return true;
}
