import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createWalletPin } from '../api/user';

const TEAL = '#00926e';

export default function WalletPinScreen() {
  const navigation = useNavigation();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
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
      await createWalletPin(pin, confirm);
      setPin('');
      setConfirm('');
      Alert.alert('Wallet PIN', 'Your wallet PIN is ready.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Wallet PIN', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>Create a 4-digit PIN. You will enter it to confirm sends and withdrawals.</Text>
      <Text style={styles.label}>PIN</Text>
      <TextInput
        value={pin}
        onChangeText={text => setPin(text.replace(/\D/g, '').slice(0, 4))}
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
        onChangeText={text => setConfirm(text.replace(/\D/g, '').slice(0, 4))}
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
          void onCreate();
        }}
        accessibilityRole="button"
        accessibilityLabel="Create wallet PIN"
      >
        <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Create PIN'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8', padding: 16 },
  intro: { fontSize: 14, lineHeight: 20, color: '#374151', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#111111', marginBottom: 8, marginTop: 12 },
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
});
