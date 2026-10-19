import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { resetWalletPin, verifyWalletPinReset } from '../api/user';

const TEAL = '#00926e';

function digits(text, max) {
  return text.replace(/\D/g, '').slice(0, max);
}

export default function WalletPinResetScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const email = String(route.params?.email ?? '');
  const [codeOpen, setCodeOpen] = useState(true);
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const onVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('PIN', 'Enter the 6-digit PIN from your email.');
      return;
    }
    setBusy(true);
    try {
      const data = await verifyWalletPinReset(code);
      const token = data?.resetToken ? String(data.resetToken) : '';
      if (!token) {
        Alert.alert('PIN', 'Could not confirm that PIN.');
        return;
      }
      setResetToken(token);
      setCodeOpen(false);
    } catch (error) {
      Alert.alert('PIN', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (pin.length !== 4 || confirm.length !== 4) {
      Alert.alert('Wallet PIN', 'Enter a 4-digit PIN and confirm it.');
      return;
    }
    if (pin !== confirm) {
      Alert.alert('Wallet PIN', 'PIN and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await resetWalletPin(resetToken, pin, confirm);
      Alert.alert('Wallet PIN', 'Your wallet PIN was updated.', [
        { text: 'OK', onPress: () => navigation.navigate('Wallet-settings') },
      ]);
    } catch (error) {
      Alert.alert('Wallet PIN', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>New wallet PIN</Text>
      <Text style={styles.subtitle}>
        {codeOpen
          ? `A PIN was sent to ${email || 'your email'}. Confirm it to continue.`
          : 'Choose a new 4-digit PIN for this wallet.'}
      </Text>
      {!codeOpen ? (
        <>
          <Text style={styles.label}>New PIN</Text>
          <TextInput
            value={pin}
            onChangeText={text => setPin(digits(text, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder="4 digits"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
          <Text style={styles.label}>Confirm PIN</Text>
          <TextInput
            value={confirm}
            onChangeText={text => setConfirm(digits(text, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder="Repeat 4 digits"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
          <Pressable
            style={[styles.button, busy && styles.disabled]}
            disabled={busy}
            onPress={() => {
              void onSave();
            }}
            accessibilityRole="button"
            accessibilityLabel="Save wallet PIN"
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Reset PIN</Text>}
          </Pressable>
        </>
      ) : null}

      <Modal visible={codeOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.modalTitle}>Enter PIN</Text>
            <Text style={styles.subtitle}>Check {email || 'your email'} for the 6-digit PIN.</Text>
            <TextInput
              value={code}
              onChangeText={text => setCode(digits(text, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor="#9CA3AF"
              style={styles.codeInput}
              autoFocus
            />
            <Pressable
              style={[styles.button, busy && styles.disabled]}
              disabled={busy}
              onPress={() => {
                void onVerify();
              }}
              accessibilityRole="button"
              accessibilityLabel="Verify PIN"
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify PIN</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#111111' },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#6B7280' },
  label: { marginTop: 16, marginBottom: 8, fontSize: 13, fontWeight: '700', color: '#111111' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    letterSpacing: 6,
    color: '#111111',
  },
  button: {
    marginTop: 20,
    backgroundColor: TEAL,
    borderRadius: 7,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { backgroundColor: '#9CA3AF' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111111' },
  codeInput: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 7,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    color: '#111111',
  },
});
