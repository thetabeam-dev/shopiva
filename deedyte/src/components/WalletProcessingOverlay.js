import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

export default function WalletProcessingOverlay({ visible, label = 'Processing…' }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.root}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#00926E" />
          <Text style={styles.label}>{label}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    minWidth: 180,
  },
  label: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
});
