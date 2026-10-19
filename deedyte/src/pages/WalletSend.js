import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchWalletRecipient } from '../api/user';

const TEAL = '#00926e';

export default function WalletSendScreen() {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [profile, setProfile] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  const lookupRecipient = async address => {
    const next = String(address ?? '').trim();
    setProfile(null);
    if (!next) {
      setLookupError('');
      return;
    }
    setLookingUp(true);
    setLookupError('');
    try {
      const row = await fetchWalletRecipient(next);
      setProfile(row);
    } catch (error) {
      setProfile(null);
      setLookupError(error instanceof Error ? error.message : String(error));
    } finally {
      setLookingUp(false);
    }
  };

  const name = [profile?.fname, profile?.lname].filter(Boolean).join(' ').trim();

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Recipient Address</Text>
      <TextInput
        value={recipient}
        onChangeText={text => {
          setRecipient(text);
          setProfile(null);
          setLookupError('');
        }}
        onEndEditing={() => {
          void lookupRecipient(recipient);
        }}
        placeholder="Wallet address"
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      {lookingUp ? <ActivityIndicator color={TEAL} style={styles.lookup} /> : null}
      {profile ? (
        <View style={styles.profile}>
          <Text style={styles.profileName}>{name || 'Wallet user'}</Text>
          <Text style={styles.profileMeta}>Phone {profile.phone || profile.address}</Text>
        </View>
      ) : null}
      {lookupError ? <Text style={styles.error}>{lookupError}</Text> : null}
      <Text style={styles.label}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
      <Text style={styles.label}>Remark</Text>
      <TextInput
        value={remark}
        onChangeText={setRemark}
        placeholder="Add a note"
        placeholderTextColor="#9CA3AF"
        style={[styles.input, styles.remark]}
        multiline
      />
      <Pressable style={styles.button} accessibilityRole="button" accessibilityLabel="Send money">
        <Text style={styles.buttonText}>Send</Text>
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
    fontSize: 16,
    color: '#111111',
  },
  remark: { minHeight: 88, textAlignVertical: 'top' },
  lookup: { marginTop: 10, alignSelf: 'flex-start' },
  profile: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  profileName: { fontSize: 16, fontWeight: '800', color: '#111111' },
  profileMeta: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  error: { marginTop: 8, fontSize: 13, color: '#B91C1C' },
  button: {
    marginTop: 20,
    backgroundColor: TEAL,
    borderRadius: 7,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
