import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const TEAL = '#00926e';
const RED = '#B91C1C';

function presentation(type) {
  const kind = String(type ?? '').toLowerCase();
  if (kind === 'topup') return { title: 'Top up', icon: 'add', credit: true };
  if (kind === 'receive') return { title: 'Received', icon: 'arrow-down', credit: true };
  if (kind === 'send') return { title: 'Sent', icon: 'arrow-up', credit: false };
  if (kind === 'withdraw') return { title: 'Withdrawal', icon: 'remove', credit: false };
  return { title: 'Transaction', icon: 'swap-horizontal', credit: false };
}

function whenLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} · ${time}`;
}

function money(kobo) {
  const amount = Number(kobo) / 100;
  const value = Number.isFinite(amount) ? amount : 0;
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WalletTransactionRow({ item }) {
  const view = presentation(item?.type);
  const color = view.credit ? TEAL : RED;
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: view.credit ? '#E8F6F1' : '#FEE2E2' }]}>
        <Icon name={view.icon} size={22} color={color} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{view.title}</Text>
        <Text style={styles.when}>{whenLabel(item?.created_at)}</Text>
      </View>
      <Text style={[styles.amount, { color }]}>
        {view.credit ? '+' : '-'}
        {money(item?.amount_kobo)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: '#111111' },
  when: { marginTop: 2, fontSize: 13, color: '#6B7280' },
  amount: { fontSize: 16, fontWeight: '800' },
});
