import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useProfile } from '../context/ProfileContext';
import { fetchShopPayoutAccount } from '../api/shop';
import { fetchWallet, withdrawWalletMoney } from '../api/user';
import { formatNaira } from '../utils/formatNaira';
import WalletConfirmSheet from '../components/WalletConfirmSheet';
import WalletPinModals from '../components/WalletPinModals';

const TEAL = '#00926e';
const BORDER = '#E5E7EB';

function field(row, snake, camel) {
  if (!row) return '';
  const value = row[snake] != null ? row[snake] : row[camel];
  return value != null ? String(value) : '';
}

export default function WalletWithdrawScreen() {
  const navigation = useNavigation();
  const { user } = useProfile();
  const userId = Number(user?.id);
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [hasPin, setHasPin] = useState(false);
  const [payout, setPayout] = useState(null);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [missingPin, setMissingPin] = useState(false);

  const bank = field(payout, 'bank_name', 'bankName');
  const accountNumber = field(payout, 'account_number', 'accountNumber');
  const accountName = field(payout, 'account_name', 'accountName');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setPayoutLoading(true);
      const load = async () => {
        try {
          const row = await fetchWallet();
          if (cancelled) return;
          const kobo = Number(row?.balance_kobo);
          setBalance(Number.isFinite(kobo) ? kobo / 100 : 0);
          setHasPin(Boolean(row?.has_pin));
        } catch {
          if (!cancelled) setBalance(0);
        }
        if (!Number.isFinite(userId) || userId <= 0) {
          if (!cancelled) {
            setPayout(null);
            setPayoutLoading(false);
          }
          return;
        }
        try {
          const saved = await fetchShopPayoutAccount(0, userId);
          if (!cancelled) setPayout(saved);
        } catch {
          if (!cancelled) setPayout(null);
        } finally {
          if (!cancelled) setPayoutLoading(false);
        }
      };
      void load();
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const amountValue = Number(amount);
  const overBalance = Number.isFinite(amountValue) && amountValue > balance;
  const hasPayout = Boolean(bank && accountNumber && accountName);
  const canWithdraw = hasPayout && amountValue > 0 && amountValue <= balance && !payoutLoading;

  const onAmountChange = text => {
    const cleaned = text.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    const next = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}` : parts[0];
    setAmount(next);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={onAmountChange}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
      <View style={styles.amountRow}>
        <Pressable
          style={styles.allBtn}
          onPress={() => setAmount(balance.toFixed(2))}
          accessibilityRole="button"
          accessibilityLabel="Withdraw full balance"
        >
          <Text style={styles.allBtnText}>All</Text>
        </Pressable>
        <Text style={styles.balanceHint}>Available {formatNaira(balance)}</Text>
      </View>
      {overBalance ? (
        <Text style={styles.amountError}>Amount cannot be more than your available balance.</Text>
      ) : null}

      <Text style={styles.label}>Payout account</Text>
      {payoutLoading ? (
        <ActivityIndicator color={TEAL} style={styles.loader} />
      ) : hasPayout ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Bank</Text>
          <Text style={styles.value}>{bank}</Text>
          <Text style={styles.muted}>Account number</Text>
          <Text style={styles.value}>{accountNumber}</Text>
          <Text style={styles.muted}>Account name</Text>
          <Text style={styles.value}>{accountName}</Text>
          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate('Wallet-payout')}
            accessibilityRole="button"
            accessibilityLabel="Change payout account"
          >
            <Text style={styles.secondaryText}>Change payout account</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.empty}>Add a payout account before you can withdraw.</Text>
          <Pressable
            style={styles.secondary}
            onPress={() => navigation.navigate('Wallet-payout')}
            accessibilityRole="button"
            accessibilityLabel="Set up payout account"
          >
            <Text style={styles.secondaryText}>Set up payout account</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.button, !canWithdraw && styles.disabledButton]}
        disabled={!canWithdraw}
        onPress={() => setConfirming(true)}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canWithdraw }}
        accessibilityLabel="Withdraw"
      >
        <Text style={styles.buttonText}>Withdraw</Text>
      </Pressable>
      <WalletConfirmSheet
        visible={confirming}
        amount={amountValue}
        balance={balance}
        bank={bank}
        accountNumber={accountNumber}
        accountName={accountName}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          if (hasPin) setPinOpen(true);
          else setMissingPin(true);
        }}
      />
      <WalletPinModals
        hasPin={hasPin}
        pinVisible={pinOpen}
        missingVisible={missingPin}
        onClosePin={() => setPinOpen(false)}
        onCloseMissing={() => setMissingPin(false)}
        onVerified={async enteredPin => {
          setPinOpen(false);
          try {
            await withdrawWalletMoney({
              amount: amountValue,
              pin: enteredPin,
              bank,
              accountNumber,
              accountName,
            });
            setAmount('');
            Alert.alert('Withdraw', 'The withdrawal was recorded.', [
              { text: 'OK', onPress: () => navigation.navigate('Wallet') },
            ]);
          } catch (error) {
            Alert.alert('Withdraw', error instanceof Error ? error.message : String(error));
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: '700', color: '#111111', marginBottom: 8, marginTop: 12 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  allBtn: {
    backgroundColor: TEAL,
    borderRadius: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  allBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  balanceHint: { flex: 1, fontSize: 13, color: '#6B7280' },
  amountError: { marginTop: 8, fontSize: 13, color: '#B91C1C' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
  },
  loader: { marginVertical: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  muted: { marginTop: 8, fontSize: 12, color: '#6B7280' },
  value: { marginTop: 2, fontSize: 16, fontWeight: '800', color: '#111111' },
  empty: { fontSize: 14, lineHeight: 20, color: '#374151' },
  secondary: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryText: { color: TEAL, fontSize: 15, fontWeight: '700' },
  button: {
    marginTop: 20,
    backgroundColor: TEAL,
    borderRadius: 7,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabledButton: { backgroundColor: '#9CA3AF' },
});
