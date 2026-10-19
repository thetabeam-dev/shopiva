import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { changeWalletPin } from '../api/user';

const TEAL = '#00926e';

function digits(text) {
  return text.replace(/\D/g, '').slice(0, 4);
}

export default function WalletPinChangeScreen() {
  const navigation = useNavigation();
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (current.length !== 4 || pin.length !== 4 || confirm.length !== 4) {
      Alert.alert('Change PIN', 'Each PIN must be 4 digits.');
      return;
    }
    if (pin !== confirm) {
      Alert.alert('Change PIN', 'New PIN and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await changeWalletPin(current, pin, confirm);
      Alert.alert('Change PIN', 'Your wallet PIN was updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Change PIN', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Current PIN</Text>
      <TextInput
        value={current}
        onChangeText={text => setCurrent(digits(text))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        placeholder="4 digits"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
      <Text style={styles.label}>New PIN</Text>
      <TextInput
        value={pin}
        onChangeText={text => setPin(digits(text))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        placeholder="4 digits"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
      <Text style={styles.label}>Confirm new PIN</Text>
      <TextInput
        value={confirm}
        onChangeText={text => setConfirm(digits(text))}
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
        accessibilityLabel="Save new PIN"
      >
        <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save PIN'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8', padding: 16 },
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
