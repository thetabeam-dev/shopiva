import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProfile } from '../context/ProfileContext';
import { requestWalletPinReset } from '../api/user';

const TEAL = '#00926e';

export default function WalletPinRecoveryScreen() {
  const navigation = useNavigation();
  const { user } = useProfile();
  const [email, setEmail] = useState(String(user?.email ?? ''));
  const [busy, setBusy] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onConfirm = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!valid) {
      Alert.alert('Email', 'Enter the email on your Deedyte account.');
      return;
    }
    setBusy(true);
    try {
      await requestWalletPinReset(trimmed);
      navigation.navigate('Wallet-pin-reset', { email: trimmed });
    } catch (error) {
      Alert.alert('Wallet PIN', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Reset wallet PIN</Text>
      <Text style={styles.subtitle}>
        Enter the email on your account. If it matches, we will send a PIN to that inbox.
      </Text>
      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#9CA3AF"
        editable={!busy}
        style={styles.input}
      />
      <Pressable
        style={[styles.button, (!valid || busy) && styles.disabled]}
        disabled={!valid || busy}
        onPress={() => {
          void onConfirm();
        }}
        accessibilityRole="button"
        accessibilityLabel="Confirm email"
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Confirm email</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#111111' },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#6B7280' },
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, fontWeight: '700', color: '#111111' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
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
