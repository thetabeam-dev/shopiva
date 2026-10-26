import { useEffect, useState } from 'react';
import { Appearance, Linking, Text, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WIPE_STORAGE_ON_LAUNCH } from './src/auth/devAuth';
import { clearAllDeedyteStorage } from './src/auth/session';
import { getPaystackPublicKey, isPaystackConfigured, warnIfPaystackLiveInDev } from './src/config/paystack';
import { getPaystackProvider } from './src/paystack/paystackNativeGate';
import NavigationHandler from './src/navigation/index';
import { setupFcmListeners } from './src/utils/firebaseTokenReqConfig';
import { checkForUpdate } from './src/api';

function App() {
  useEffect(() => {
    Appearance.setColorScheme('unspecified');
  }, []);

  // const handleDeepLink = (url) => {
  //   if (!url) return;

  //   const parsed = new URL(url);
  //   const pathname = parsed.pathname;

  //   const match = pathname.match(
  //     /^\/store\/([^/]+)\/product\/([^/]+)$/
  //   );

  //   if (!match) return;

  //   const shopSlug = decodeURIComponent(match[1]);
  //   const productId = match[2];

  //   console.log({
  //     shopSlug,
  //     productId,
  //   });
  //   navigation.navigate('Product', {
  //     shopSlug,
  //     productId,
  //   });

  //   // Navigate to your product screen
  // };

  // useEffect(() => {
  //   // const handleDeepLink = ({ url }) => {
  //   //   if (!url) return;

  //   //   const parsed = new URL(url);

  //   //   console.log('Deep link:', parsed.pathname);

  //   //   // Example:
  //   //   // /store/fabians-store/product/123
  //   // };

  //   Linking.getInitialURL().then((url) => {
  //     if (url) {
  //       handleDeepLink({ url });
  //     }
  //   });

  //   const subscription = Linking.addEventListener(
  //     'url',
  //     handleDeepLink
  //   );

  //   return () => {
  //     subscription.remove();
  //   };
  // }, []);

  useEffect(() => {
    if (WIPE_STORAGE_ON_LAUNCH) {
      void clearAllDeedyteStorage();
    }
    warnIfPaystackLiveInDev();
  }, []);

  useEffect(() => {
    const unsubscribe = setupFcmListeners();
    return () => {
      unsubscribe();
    };
  }, []);

  const [versionCheck, setVersionCheck] = useState({
    isLatest: true,
    storeUrl: '',
    isUpdating: false
  });

  useEffect(() => {
    (async () => {
      try {
        const data = await checkForUpdate();
        if (data && typeof data === 'object') {
          const isUpdating = String(data.isUpdating ?? '').trim().toLowerCase() === 'true';
          const storeUrl = typeof data.storeUrl === 'string' ? data.storeUrl : '';
          const isLatest = Boolean(data.isLatest);
          setVersionCheck({
            isLatest: isLatest || (!storeUrl && !isUpdating),
            storeUrl,
            isUpdating,
          });
        }
      } catch (error) {
        console.warn('[app] version check failed:', error instanceof Error ? error.message : String(error));
      }
    })();
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

  const appBody = <NavigationHandler />;

  return (
    <>
        {!versionCheck.isUpdating && !versionCheck.isLatest ? (
          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              justifyContent: 'center',
              paddingHorizontal: 28,
            }}
          >
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={openStore}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#111111', textAlign: 'center', marginBottom: 10 }}>
                Update required
              </Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: '#555555', textAlign: 'center', marginBottom: 20 }}>
                Your app is outdated. Install the latest version to keep using Deedyte.
              </Text>
              <TouchableOpacity onPress={openStore} activeOpacity={0.85}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#00926e', textAlign: 'center' }}>
                  Click Here To Download The Latest Version
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </SafeAreaView>
        ) : null}

        {versionCheck.isLatest || versionCheck.isUpdating ? (
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
        ) : null}
    </>
  );
}

export default App;
