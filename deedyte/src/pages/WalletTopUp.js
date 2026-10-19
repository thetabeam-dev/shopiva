import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { fetchWallet } from '../api/user';

const TEAL = '#00926e';
const QUICK = [500, 1000, 2000, 5000, 10000, 20000];

export default function WalletTopUpScreen() {
  const navigation = useNavigation();
  const [amount, setAmount] = useState('0');
  const [wallet, setWallet] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchWallet()
        .then(row => {
          if (!cancelled) setWallet(row);
        })
        .catch(() => {
          if (!cancelled) setWallet(null);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const bank = String(wallet?.bank_name ?? '').trim() || 'Not available yet';
  const accountName = String(wallet?.account_name ?? '').trim() || 'Not available yet';
  const accountNumber = String(wallet?.account_number ?? '').trim() || 'Not available yet';

  const copyText = (text, label) => {
    const value = String(text ?? '').trim();
    if (!value || value === 'Not available yet') return;
    Clipboard.setString(value);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* <View style={styles.bankTab}>
        <Text style={styles.bankTabText}>Bank</Text>
      </View> */}

      <Text style={styles.label}>Amount (optional)</Text>
      <TextInput
        value={amount}
        onChangeText={text => setAmount(text.replace(/[^\d.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
      <Text style={styles.hint}>Optional — any amount you send is credited automatically.</Text>

      <Text style={styles.label}>Quick select</Text>
      <View style={styles.chips}>
        {QUICK.map(value => {
          const selected = Number(amount) === value;
          return (
            <Pressable
              key={value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setAmount(String(value))}
              accessibilityRole="button"
              accessibilityLabel={`₦${value}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>₦{value}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Your Deedyte account</Text>
          <Pressable
            onPress={() => {
              copyText(`Bank: ${bank}\nAccount name: ${accountName}\nAccount number: ${accountNumber}`, 'Account details')
            }}
            accessibilityRole="button"
            accessibilityLabel="Copy all"
          >
            <Text style={styles.copyAll}>Copy all</Text>
          </Pressable>
        </View>
        <Text style={styles.cardHint}>Transfer any amount here — it lands in your wallet automatically.</Text>

        {[
          ['Bank', bank],
          ['Account name', accountName],
          ['Account number', accountNumber],
        ].map(([label, value]) => (
          <View key={label} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.muted}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
            <Pressable
              onPress={() => {
                copyText(value, label)
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${label}`}
            >
              <Icon name="copy-outline" size={18} color="#6B7280" />
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable
        style={styles.button}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="I've sent the money"
      >
        <Text style={styles.buttonText}>I've sent the money</Text>
      </Pressable>
      <Text style={styles.footer}>
        Or wait — your balance updates automatically when Paystack confirms the transfer.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 16, paddingBottom: 32 },
  bankTab: {
    backgroundColor: TEAL,
    borderRadius: 7,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankTabText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  label: { marginTop: 18, marginBottom: 8, fontSize: 14, color: '#111111' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  hint: { marginTop: 8, fontSize: 13, lineHeight: 18, color: '#6B7280' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: { borderColor: TEAL, backgroundColor: '#E8F6F1' },
  chipText: { fontSize: 14, fontWeight: '700', color: '#111111' },
  chipTextSelected: { color: TEAL },
  card: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111111' },
  copyAll: { color: TEAL, fontSize: 14, fontWeight: '700' },
  cardHint: { marginTop: 8, fontSize: 13, lineHeight: 18, color: '#6B7280' },
  row: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: { flex: 1 },
  muted: { fontSize: 12, color: '#6B7280' },
  value: { marginTop: 2, fontSize: 16, fontWeight: '800', color: '#111111' },
  button: {
    marginTop: 20,
    backgroundColor: TEAL,
    borderRadius: 7,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: { marginTop: 12, textAlign: 'center', fontSize: 13, lineHeight: 18, color: '#6B7280' },
});
