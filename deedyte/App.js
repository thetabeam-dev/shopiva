import { useEffect, useState } from 'react';
import { Linking, Platform, StatusBar, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WIPE_STORAGE_ON_LAUNCH } from './src/auth/devAuth';
import { clearAllDeedyteStorage } from './src/auth/session';
import { getPaystackPublicKey, isPaystackConfigured, warnIfPaystackLiveInDev } from './src/config/paystack';
import { getPaystackProvider } from './src/paystack/paystackNativeGate';
import NavigationHandler from './src/navigation/index';
import {
  getFcmToken,
  requestPermission,
  requestAndroidPermission,
  setupFcmListeners,
} from './src/utils/firebaseTokenReqConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { DEFAULT_API_BASE_URL } from './src/api/config';
import { checkForUpdate } from './src/api';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    if (WIPE_STORAGE_ON_LAUNCH) {
      void clearAllDeedyteStorage();
    }
    warnIfPaystackLiveInDev();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await requestAndroidPermission();
          if (!granted && Platform.Version >= 33) {
            return;
          }
        }

        if (!cancelled) {
          await requestPermission();
        }
      } catch (error) {
        console.warn('[fcm] initial setup failed:', error instanceof Error ? error.message : String(error));
      }
    })();

    const unsubscribe = setupFcmListeners();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const [versionCheck, setVersionCheck] = useState({
    isLatest: true,
    storeUrl: '',
  });

  useEffect(() => {
    (async () => {
      const data = await checkForUpdate();
      if (data && typeof data === 'object') {
        setVersionCheck({
          isLatest: Boolean(data.isLatest),
          storeUrl: typeof(data.storeUrl) === 'string' ? data.storeUrl : '',
        });
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getFcmToken();
        if (!token || cancelled) {
          return;
        }
        console.log('Device FCM Token:', token);
        await AsyncStorage.setItem('fcm', token);
      } catch (error) {
        console.warn('Device FCM Token Error:', error instanceof Error ? error.message : String(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openStore = () => {
    const url = versionCheck.storeUrl?.trim();
    console.log("url: ", url)
    if (!url) {
      return;
    }
    void Linking.openURL(url);
  };


  const paystackPublicKey = getPaystackPublicKey();
  const paystackReady = isPaystackConfigured();
  const PaystackProvider = paystackReady ? getPaystackProvider() : null;

  const appBody = (
    <>
      {/* <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} /> */}
      <NavigationHandler />
    </>
  );

  return (
    <>

    {
      !versionCheck.isLatest &&
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
      >
        <TouchableOpacity onPress={openStore}
          // disabled={!versionCheck.storeUrl?.trim()}
          activeOpacity={0.85}
          accessibilityRole="link"
          accessibilityLabel={
            Platform.OS === 'ios'
              ? 'Open App Store to download latest version'
              : 'Open Play Store to download latest version'
          }>
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: '#111111',
                textAlign: 'center',
                marginBottom: 10,
              }}
            >
              Update required
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 22,
                color: '#555555',
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              Your app is outdated. Install the latest version to keep using Deedyte.
            </Text>
            <TouchableOpacity
              onPress={openStore}
              // disabled={!versionCheck.storeUrl?.trim()}
              activeOpacity={0.85}
              accessibilityRole="link"
              accessibilityLabel={
                Platform.OS === 'ios'
                  ? 'Open App Store to download latest version'
                  : 'Open Play Store to download latest version'
              }
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#00926e',
                  textAlign: 'center',
                  cursor: "pointer"
                  // opacity: versionCheck.storeUrl?.trim() ? 1 : 0.5,
                }}
              >
                Click Here To Download The Latest Version
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </SafeAreaView>
    }

    {
      versionCheck.isLatest &&
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider style={{ flex: 1 }}>
          {PaystackProvider ? (
            <PaystackProvider
              publicKey={paystackPublicKey}
              currency="NGN"
              defaultChannels={['card', 'ussd', 'bank']}
              debug={__DEV__}
            >
              {appBody}
            </PaystackProvider>
          ) : (
            appBody
          )}
        </SafeAreaProvider>
      </GestureHandlerRootView>
    }

    </>
  );
}

export default App;
