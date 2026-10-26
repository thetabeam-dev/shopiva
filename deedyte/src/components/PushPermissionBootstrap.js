import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import {
  getFcmToken,
  requestAndroidPermission,
  requestPermission,
} from '../utils/firebaseTokenReqConfig';

let askedThisLaunch = false;

/**
 * Asks for notification permission only after auth has left the boot screen
 * and the activity is in the foreground, so it cannot overlap splash navigation.
 */
export default function PushPermissionBootstrap() {
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'loading' || askedThisLaunch) return undefined;

    let cancelled = false;

    const run = async () => {
      if (cancelled || askedThisLaunch) return;
      if (AppState.currentState !== 'active') return;
      askedThisLaunch = true;
      try {
        if (Platform.OS === 'android') {
          const granted = await requestAndroidPermission();
          if (!granted && Platform.Version >= 33) return;
        }
        if (cancelled) return;
        await requestPermission();
        const token = await getFcmToken();
        if (token && !cancelled) {
          await AsyncStorage.setItem('fcm', token);
        }
      } catch (error) {
        console.warn(
          '[fcm] deferred setup failed:',
          error instanceof Error ? error.message : String(error),
        );
      }
    };

    const timer = setTimeout(() => {
      void run();
    }, 2500);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [status]);

  return null;
}
