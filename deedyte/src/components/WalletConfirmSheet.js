import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatNaira } from '../utils/formatNaira';

const TEAL = '#00926e';

function money(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '₦0.00';
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WalletConfirmSheet({
  visible,
  onClose,
  onConfirm,
  amount,
  balance,
  bank,
  accountNumber,
  accountName,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close confirmation" />
        <View style={styles.sheet}>
          <View style={styles.topRow}>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.total}>{money(amount)}</Text>
          <View style={styles.card}>
            <Row label="Bank" value={bank || 'Not available yet'} />
            <Row label="Account Number" value={accountNumber || 'Not available yet'} />
            <Row label="Name" value={accountName || 'Not available yet'} />
            <Row label="Amount" value={money(amount)} />
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Available Balance ({formatNaira(balance)})</Text>
          </View>
          <Pressable style={styles.pay} onPress={onConfirm} accessibilityRole="button" accessibilityLabel="Pay">
            <Text style={styles.payText}>Pay</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#F7F7F8',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  close: { fontSize: 28, color: '#111111', lineHeight: 30 },
  total: { marginTop: 8, marginBottom: 16, textAlign: 'center', fontSize: 32, fontWeight: '800', color: '#111111' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowLabel: { fontSize: 14, color: '#6B7280' },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: '#111111' },
  balanceBox: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  balanceLabel: { fontSize: 15, fontWeight: '700', color: '#111111' },
  pay: {
    marginTop: 18,
    backgroundColor: TEAL,
    borderRadius: 28,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
