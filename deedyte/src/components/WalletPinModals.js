import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { verifyWalletPin } from '../api/user';

const TEAL = '#00926e';

export default function WalletPinModals({
  hasPin,
  pinVisible,
  missingVisible,
  onClosePin,
  onCloseMissing,
  onVerified,
}) {
  const navigation = useNavigation();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const closePin = () => {
    setPin('');
    setError('');
    onClosePin();
  };

  const submit = async () => {
    if (pin.length !== 4) {
      setError('Enter your 4-digit PIN.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verifyWalletPin(pin);
      const entered = pin;
      setPin('');
      await onVerified(entered);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal visible={missingVisible} transparent animationType="fade" onRequestClose={onCloseMissing}>
        <View style={styles.centerRoot}>
          <View style={styles.card}>
            <Text style={styles.title}>Create a wallet PIN</Text>
            <Text style={styles.body}>
              This wallet has no PIN yet. Create a 4-digit PIN before you can send or withdraw.
            </Text>
            <Pressable
              style={styles.button}
              onPress={() => {
                onCloseMissing();
                navigation.navigate('Wallet-pin');
              }}
              accessibilityRole="button"
              accessibilityLabel="Create PIN"
            >
              <Text style={styles.buttonText}>Create PIN</Text>
            </Pressable>
            <Pressable onPress={onCloseMissing} accessibilityRole="button" accessibilityLabel="Not now">
              <Text style={styles.later}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={pinVisible} transparent animationType="fade" onRequestClose={closePin}>
        <View style={styles.centerRoot}>
          <View style={styles.card}>
            <Text style={styles.title}>Wallet PIN</Text>
            <Text style={styles.body}>Enter your 4-digit PIN to confirm this payment.</Text>
            <TextInput
              value={pin}
              onChangeText={text => {
                setPin(text.replace(/\D/g, '').slice(0, 4));
                setError('');
              }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="••••"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              editable={hasPin}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {busy ? <ActivityIndicator color={TEAL} style={styles.loader} /> : null}
            <Pressable
              style={[styles.button, (busy || pin.length !== 4) && styles.disabled]}
              disabled={busy || pin.length !== 4}
              onPress={() => {
                void submit();
              }}
              accessibilityRole="button"
              accessibilityLabel="Confirm PIN"
            >
              <Text style={styles.buttonText}>Confirm</Text>
            </Pressable>
            <Pressable onPress={closePin} accessibilityRole="button" accessibilityLabel="Cancel PIN">
              <Text style={styles.later}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function alertPinVerified(kind) {
  Alert.alert('Confirmed', kind === 'withdraw' ? 'Withdrawal PIN confirmed.' : 'Send PIN confirmed.');
}

const styles = StyleSheet.create({
  centerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111111' },
  body: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#374151' },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    color: '#111111',
  },
  error: { marginTop: 8, fontSize: 13, color: '#B91C1C' },
  loader: { marginTop: 12 },
  button: {
    marginTop: 16,
    backgroundColor: TEAL,
    borderRadius: 7,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { backgroundColor: '#9CA3AF' },
  later: { marginTop: 14, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#6B7280' },
});
