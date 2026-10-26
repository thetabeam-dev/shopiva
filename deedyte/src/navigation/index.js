

import React, { useCallback, useEffect } from 'react';
import RootNavigator from './authentication';
import {
  Alert,
  AppState,
  Linking,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import axios from 'axios'
import { NavigationContainer } from '@react-navigation/native';
import { parseOAuthCallbackUrl, oauthErrorMessage } from '../api/oauth';
import AuthBootstrap from '../auth/AuthBootstrap';
import CategoryBootstrap from '../categories/CategoryBootstrap';
import PushPermissionBootstrap from '../components/PushPermissionBootstrap';
import { useAuth } from '../hooks/useAuth';
import { Provider, useDispatch } from 'react-redux';
import store from "../../redux/store"
import Tools from "../utils/gen"
import { set_nested_nav } from '../../redux/nested_nav';
import { navigationRef } from './root';
import { connectChatSocket } from '../socket/chatSocket';
import { DEFAULT_API_BASE_URL } from '../api/config';
import { getMessaging } from '@react-native-firebase/messaging';
import { getStoredUser } from '../auth/session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';


export { navigationRef, navigate } from './root';

/** Renders inside `<Provider>` so `useDispatch` and navigation share one Redux context. */
function NavigationTree() {
  const dispatch = useDispatch();
  const { signIn, status, isAuthenticated } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // The native module marks the referrer as consumed on first read, so it
    // must not be read until a real account is signed in.
    if (status !== 'signedIn' || !isAuthenticated) return;
    NativeModules.InstallReferrer?.getReferrer()
      .then((raw) => {
        if (!raw) return;
        const params = new URLSearchParams(raw);
        const link = params.get('deeplink');
        if (link) {
          Alert.alert(JSON.stringify(link));
          // e.g. https://www.deedyte.com/store/greg/product/123
          // route it the same way you handle normal deep links
        }
      })
      .catch(() => { });
  }, [status, isAuthenticated]);

  const handleOAuthUrl = useCallback(
    async (url) => {
      if (!url || !String(url).includes('deedyte://oauth')) {
        return;
      }
      const parsed = parseOAuthCallbackUrl(String(url));
      if (!parsed) {
        return;
      }
      if (parsed.error) {
        Alert.alert('Sign-in', oauthErrorMessage(parsed.error));
        return;
      }
      if (!parsed.token) {
        return;
      }
      try {
        await signIn(parsed.token, parsed.user ?? null);
      } catch (e) {
        Alert.alert('Sign-in', e instanceof Error ? e.message : String(e));
      }
    },
    [signIn],
  );

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleOAuthUrl(url);
    });
    Linking.getInitialURL().then((url) => {
      if (url) void handleOAuthUrl(url);
    });
    return () => sub.remove();
  }, [handleOAuthUrl]);

  useEffect(() => {
    if (status !== 'signedIn') return undefined;
    connectChatSocket().catch(() => { });
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') connectChatSocket().catch(() => { });
    });
    return () => sub.remove();
  }, [status]);

  useEffect(() => {
    async function getFcm() {
      const u = await getStoredUser();
      if (!u) return;
      if (u.devicetoken) return;
      const fcm = await AsyncStorage.getItem("fcm");
      if (!fcm) return;
      axios.post(`${DEFAULT_API_BASE_URL}/update-fcm`, {
        u_id: u?.id,
        fcm: fcm
      })
        .then((res) => {
          //  console.log(res.data)
        })
        .catch(err => {
          //  console.log(err)
        })
    }
    getFcm()
  }, []);

  useEffect(() => {
    try {
      const unsub = getMessaging().onTokenRefresh(async (token) => {
        const u = await getStoredUser();
        if (!token || !u?.id) return;
        axios.post(`${DEFAULT_API_BASE_URL}/update-fcm`, {
          u_id: u.id,
          fcm: token,
        }).catch(() => { });
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    } catch (error) {
      console.warn(
        '[fcm] onTokenRefresh failed:',
        error instanceof Error ? error.message : String(error),
      );
      return undefined;
    }
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={async () => {
        const currentRoute = navigationRef.current?.getCurrentRoute();
        const name = currentRoute?.name;
        console.log(name);

        if (name) {
          console.log('📍 Current screen:', name);
          const rootTabRoutes = new Set([
            "Home",
            "Activities",
            "Cart",
            "Catalog",
            "Profile",
            "Explore",
            "Wallet",
            "Products",
            // 'home',
            // 'profile-main',
            // 'chat-list',
            // 'vendor-chat-list',
            // 'order-list',
            // 'dispute-list',
            // 'Home',
            // 'Cart',
            // 'Orders',
            // 'Chat',
            // 'Dispute',
            // 'Profile',
            // 'Activities',
            // 'Products',
            // 'Inventory',
            // 'VendorProductsHub',
            // 'VendorProductList',
            // 'VendorInventory',
            // 'VendorCreateProduct',
            // 'VendorOrdersHub',
            // 'VendorOrderFlow',
            // 'VendorDisputeFlow',
            // 'VendorDashboard',
            // 'CustomerOrdersHub',
            // 'CustomerOrderFlow',
            // 'CustomerDisputeFlow',
          ]);

          if (rootTabRoutes.has(name)) {
            dispatch(set_nested_nav({ boolean: true, id: Tools.generateId() }));
          } else {
            dispatch(set_nested_nav({ boolean: false, id: Tools.generateId() }));
          }
        }
      }}
    >
      <RootNavigator />
    </NavigationContainer>
  );
}

function NavigationHandler() {
  return (
    <>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
        <Provider store={store}>
          <AuthBootstrap />
          <CategoryBootstrap />
          <PushPermissionBootstrap />
          <NavigationTree />
        </Provider>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default NavigationHandler;
