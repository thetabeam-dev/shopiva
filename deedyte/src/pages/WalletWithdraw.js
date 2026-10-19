import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Dropdown } from 'react-native-element-dropdown';
import { useProfile } from '../context/ProfileContext';
import { fetchPayoutBanks, verifyPayoutAccount } from '../api/shop';
import { fetchWallet } from '../api/user';
import { formatNaira } from '../utils/formatNaira';

const TEAL = '#00926e';
const BORDER = '#E5E7EB';

export default function WalletWithdrawScreen() {
  const { user } = useProfile();
  const userId = Number(user?.id);
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [banks, setBanks] = useState(/** @type {Record<string, unknown>[]} */ ([]));
  const [banksLoading, setBanksLoading] = useState(true);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const bankOptions = useMemo(() => {
    return banks
      .map(bank => {
        const code = String(bank.code ?? bank.bank_code ?? '').trim();
        const name = String(bank.name ?? bank.bank_name ?? '').trim();
        if (!code || !name) return null;
        return { label: name, value: code };
      })
      .filter(Boolean);
  }, [banks]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchWallet()
        .then(row => {
          if (cancelled) return;
          const kobo = Number(row?.balance_kobo);
          setBalance(Number.isFinite(kobo) ? kobo / 100 : 0);
        })
        .catch(() => {
          if (!cancelled) setBalance(0);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Number.isFinite(userId) || userId <= 0) {
        setBanksLoading(false);
        return;
      }
      try {
        const list = await fetchPayoutBanks(userId);
        if (!cancelled) setBanks(list);
      } catch (error) {
        if (!cancelled) {
          Alert.alert('Banks', error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) setBanksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const clearVerification = useCallback(() => {
    setVerified(false);
    setAccountName('');
  }, []);

  const onVerify = async () => {
    const account = accountNumber.replace(/\D/g, '');
    if (account.length !== 10) {
      Alert.alert('Account number', 'Enter a valid 10-digit account number.');
      return;
    }
    if (!bankCode) {
      Alert.alert('Bank', 'Select a bank first.');
      return;
    }
    setVerifyBusy(true);
    try {
      const data = await verifyPayoutAccount(userId, account, bankCode);
      const name = data?.account_name != null ? String(data.account_name) : '';
      if (!name) {
        setVerified(false);
        setAccountName('');
        Alert.alert('Verify', 'Could not resolve this account.');
        return;
      }
      setAccountName(name);
      setVerified(true);
    } catch (error) {
      setVerified(false);
      setAccountName('');
      Alert.alert('Verify', error instanceof Error ? error.message : String(error));
    } finally {
      setVerifyBusy(false);
    }
  };

  const amountValue = Number(amount);
  const overBalance = Number.isFinite(amountValue) && amountValue > balance;
  const canWithdraw =
    verified && amountValue > 0 && amountValue <= balance && !verifyBusy;

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
        <Text style={styles.amountError}>Amount cannot be more than your balance.</Text>
      ) : null}

      <Text style={styles.label}>Bank</Text>
      {banksLoading ? (
        <ActivityIndicator color={TEAL} style={styles.loader} />
      ) : (
        <Dropdown
          style={styles.dropdown}
          containerStyle={styles.dropdownList}
          placeholderStyle={styles.placeholder}
          selectedTextStyle={styles.selected}
          itemTextStyle={styles.selected}
          data={bankOptions}
          labelField="label"
          valueField="value"
          placeholder="Select bank"
          search
          searchField="label"
          searchPlaceholder="Search banks..."
          value={bankCode}
          onChange={item => {
            setBankCode(item.value);
            clearVerification();
          }}
        />
      )}

      <Text style={styles.label}>Account number</Text>
      <TextInput
        value={accountNumber}
        onChangeText={text => {
          setAccountNumber(text.replace(/\D/g, '').slice(0, 10));
          clearVerification();
        }}
        placeholder="10 digits"
        placeholderTextColor="#9CA3AF"
        keyboardType="number-pad"
        maxLength={10}
        style={styles.input}
      />

      <Pressable
        style={[styles.verifyBtn, verifyBusy && styles.disabled]}
        onPress={() => {
          void onVerify();
        }}
        disabled={verifyBusy}
        accessibilityRole="button"
        accessibilityLabel="Verify account"
      >
        {verifyBusy ? (
          <ActivityIndicator color={TEAL} />
        ) : (
          <Text style={styles.verifyText}>Verify account</Text>
        )}
      </Pressable>

      <Text style={styles.label}>Account name</Text>
      <TextInput
        value={accountName}
        editable={false}
        placeholder="Account holder name"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />

      <Pressable
        style={[styles.button, !canWithdraw && styles.disabledButton]}
        disabled={!canWithdraw}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canWithdraw }}
        accessibilityLabel="Withdraw"
      >
        <Text style={styles.buttonText}>Withdraw</Text>
      </Pressable>
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
  dropdown: {
    height: 50,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 7,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  dropdownList: { borderRadius: 7 },
  placeholder: { fontSize: 16, color: '#9CA3AF' },
  selected: { fontSize: 16, color: '#111111' },
  loader: { marginVertical: 12 },
  verifyBtn: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  verifyText: { color: TEAL, fontSize: 16, fontWeight: '700' },
  button: {
    marginTop: 20,
    backgroundColor: TEAL,
    borderRadius: 7,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  disabledButton: { backgroundColor: '#9CA3AF' },
});
