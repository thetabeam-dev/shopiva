import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { fetchWallet } from '../../api/user';
import { completeCheckoutOrder } from '../../api/buyer';
import { connectChatSocket } from '../../socket/chatSocket';
import { formatNaira } from '../../utils/formatNaira';

const TEAL = '#00926e';

/** Round up to the next ₦10 so the transfer is never below the amount still owed. */
function roundUpToTen(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value / 10) * 10;
}

export default function CheckoutWalletTopUpScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const orderTotal = Number(route.params?.orderTotal) || 0;
  const balanceFromCheckout = Number(route.params?.walletBalance) || 0;
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(balanceFromCheckout);
  const [completing, setCompleting] = useState(false);
  const startedRef = useRef(false);
  const checkout = route.params?.checkout;

  const finishCheckout = useCallback(async (balanceNaira) => {
    if (startedRef.current || !checkout) return;
    if (!Number.isFinite(balanceNaira) || balanceNaira + 0.5 < orderTotal) return;
    startedRef.current = true;
    setCompleting(true);
    try {
      const data = await completeCheckoutOrder(checkout);
      navigation.replace('Payment-success', {
        reference: checkout.reference,
        subtotal: Number(route.params?.subtotal) || 0,
        shipping: Number(route.params?.shipping) || 0,
        total: orderTotal,
        itemCount: Number(route.params?.itemCount) || 0,
        rooms: Array.isArray(data?.rooms) ? data.rooms : [],
      });
    } catch (err) {
      startedRef.current = false;
      setCompleting(false);
      const message = err instanceof Error ? err.message : 'Could not complete checkout.';
      Alert.alert('Checkout', message);
    }
  }, [checkout, navigation, orderTotal, route.params?.itemCount, route.params?.shipping, route.params?.subtotal]);

  useEffect(() => {
    let alive = true;
    let socket = null;
    const onWalletCredited = (payload) => {
      const kobo = Number(payload?.balance_kobo);
      if (!Number.isFinite(kobo)) return;
      const next = kobo / 100;
      setBalance(next);
      void finishCheckout(next);
    };
    void connectChatSocket().then((next) => {
      if (!alive || !next) return;
      socket = next;
      next.on('wallet_credited', onWalletCredited);
    });
    return () => {
      alive = false;
      socket?.off('wallet_credited', onWalletCredited);
    };
  }, [finishCheckout]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchWallet()
        .then((row) => {
          if (cancelled) return;
          setWallet(row);
          const kobo = Number(row?.balance_kobo);
          if (Number.isFinite(kobo)) {
            const next = kobo / 100;
            setBalance(next);
            void finishCheckout(next);
          }
        })
        .catch(() => {
          if (!cancelled) setWallet(null);
        });
      return () => {
        cancelled = true;
      };
    }, [finishCheckout]),
  );

  const shortfall = Math.max(0, orderTotal - balance);
  const transferAmount = roundUpToTen(shortfall);
  const bank = String(wallet?.bank_name ?? '').trim() || 'Not available yet';
  const accountName = String(wallet?.account_name ?? '').trim() || 'Not available yet';
  const accountNumber = String(wallet?.account_number ?? '').trim() || 'Not available yet';

  const copyText = (text, label) => {
    const value = String(text ?? '').trim();
    if (!value || value === 'Not available yet') return;
    Clipboard.setString(value);
    Alert.alert('Copied', `${label} copied.`);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>Transfer this amount to your wallet. The order is placed automatically once the top-up arrives.</Text>
      {completing ? (
        <View style={styles.waiting}>
          <ActivityIndicator color={TEAL} />
          <Text style={styles.waitingText}>Wallet topped up. Completing your order…</Text>
        </View>
      ) : null}

      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Amount to transfer</Text>
        <Text style={styles.amountValue}>{formatNaira(transferAmount)}</Text>
        <Text style={styles.amountHint}>Rounded up to the next ₦10 so the transfer covers the order.</Text>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Order total</Text>
          <Text style={styles.summaryValue}>{formatNaira(orderTotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Wallet balance</Text>
          <Text style={styles.summaryValue}>{formatNaira(balance)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Still needed</Text>
          <Text style={styles.summaryValue}>{formatNaira(shortfall)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Your Deedyte account</Text>
          <Pressable
            onPress={() => {
              copyText(
                `Amount: ${formatNaira(transferAmount)}\nBank: ${bank}\nAccount name: ${accountName}\nAccount number: ${accountNumber}`,
                'Account details',
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Copy all"
          >
            <Text style={styles.copyAll}>Copy all</Text>
          </Pressable>
        </View>
        <Text style={styles.cardHint}>Send {formatNaira(transferAmount)} to this account. It is credited to your wallet when the transfer is confirmed.</Text>
        {[
          ['Bank', bank],
          ['Account name', accountName],
          ['Account number', accountNumber],
          ['Amount', formatNaira(transferAmount)],
        ].map(([label, value]) => (
          <View key={label} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.muted}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
            <Pressable
              onPress={() => copyText(value, label)}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 16, paddingBottom: 32 },
  lead: { fontSize: 15, lineHeight: 22, color: '#111111' },
  waiting: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  waitingText: { flex: 1, fontSize: 14, color: '#111111' },
  amountCard: {
    marginTop: 16,
    backgroundColor: '#E8F6F1',
    borderRadius: 7,
    padding: 16,
  },
  amountLabel: { fontSize: 13, color: '#0F6E56', fontWeight: '600' },
  amountValue: { marginTop: 6, fontSize: 32, fontWeight: '800', color: TEAL },
  amountHint: { marginTop: 8, fontSize: 13, lineHeight: 18, color: '#3D6B5E' },
  summary: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: { fontSize: 15, color: '#444444' },
  summaryValue: { fontSize: 15, fontWeight: '700', color: '#111111' },
  card: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111111' },
  copyAll: { fontSize: 14, fontWeight: '700', color: TEAL },
  cardHint: { marginTop: 8, fontSize: 13, lineHeight: 18, color: '#6B7280' },
  row: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { flex: 1, paddingRight: 12 },
  muted: { fontSize: 12, color: '#6B7280' },
  value: { marginTop: 2, fontSize: 16, fontWeight: '700', color: '#111111' },
  button: {
    marginTop: 20,
    backgroundColor: TEAL,
    borderRadius: 7,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
