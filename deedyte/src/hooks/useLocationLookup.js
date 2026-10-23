import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { LocationError, deviceLocationServicesOn, readExactLocation } from '../utils/deviceLocation';

function openSettingsFor(kind) {
  if (kind === 'services' && Platform.OS === 'android') {
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
    return;
  }
  Linking.openSettings();
}

/**
 * Shared geolocation attempt with a cancel overlay and a single return-from-settings resume.
 */
export function useLocationLookup() {
  const [visible, setVisible] = useState(false);
  const cancelledRef = useRef(false);
  const busyRef = useRef(false);
  const resumeRef = useRef(/** @type {null | { kind: 'blocked' | 'services_off'; resolve: (value: { latitude: number; longitude: number } | null) => void }} */ (null));
  const attemptRef = useRef(0);

  const runAttempt = useCallback(async () => {
    const attempt = attemptRef.current;
    setVisible(true);
    try {
      return await readExactLocation({ isCancelled: () => cancelledRef.current || attempt !== attemptRef.current });
    } finally {
      if (attempt === attemptRef.current && !resumeRef.current) setVisible(false);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const pending = resumeRef.current;
      if (!pending) return;
      resumeRef.current = null;
      void (async () => {
        try {
          const coords = await runAttempt();
          pending.resolve(coords);
        } catch (error) {
          const code = error instanceof LocationError ? error.code : '';
          if (code === 'cancelled') {
            pending.resolve(null);
            return;
          }
          if (code === 'blocked' || code === 'services_off') {
            Alert.alert(
              code === 'services_off' ? 'Device location' : 'Location permission',
              code === 'services_off'
                ? 'Location is still off on this device. Turn it on to use your current location, or enter the address manually.'
                : 'Location access is still off for Deedyte. Allow it in settings, or enter the address manually.',
              [{ text: 'OK' }],
            );
            pending.resolve(null);
            return;
          }
          const message = error instanceof Error ? error.message : 'We could not get your location.';
          Alert.alert('Location', message);
          pending.resolve(null);
        }
      })();
    });
    return () => sub.remove();
  }, [runAttempt]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    attemptRef.current += 1;
    resumeRef.current = null;
    busyRef.current = false;
    setVisible(false);
  }, []);

  const locate = useCallback(async () => {
    if (busyRef.current) return null;
    busyRef.current = true;
    cancelledRef.current = false;
    const attempt = ++attemptRef.current;
    try {
      return await runAttempt();
    } catch (error) {
      if (attempt !== attemptRef.current || (error instanceof LocationError && error.code === 'cancelled')) {
        return null;
      }
      if (error instanceof LocationError && (error.code === 'blocked' || error.code === 'services_off')) {
        setVisible(false);
        return await new Promise((resolve) => {
          Alert.alert(
            error.code === 'services_off' ? 'Device location' : 'Location permission',
            error.message,
            [
              { text: 'Not now', style: 'cancel', onPress: () => resolve(null) },
              {
                text: 'Open settings',
                onPress: () => {
                  resumeRef.current = { kind: error.code, resolve };
                  openSettingsFor(error.code === 'services_off' ? 'services' : 'permission');
                },
              },
            ],
            { cancelable: false },
          );
        });
      }
      if (error instanceof LocationError && error.code === 'denied') {
        Alert.alert('Location permission', error.message);
        return null;
      }
      const message = error instanceof Error ? error.message : 'We could not get your location.';
      Alert.alert('Location', message);
      return null;
    } finally {
      if (attempt === attemptRef.current && !resumeRef.current) busyRef.current = false;
      if (resumeRef.current) busyRef.current = false;
    }
  }, [runAttempt]);

  const locationOverlay = (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#00926e" />
          <Text style={styles.message}>Finding your location...</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={cancel} activeOpacity={0.85}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return { locating: visible, locate, cancel, locationOverlay };
}

export async function locationServicesEnabled() {
  return deviceLocationServicesOn();
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00926e',
  },
});
