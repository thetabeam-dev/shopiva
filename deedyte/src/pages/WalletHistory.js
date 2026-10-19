import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function WalletHistoryScreen() {
  return (
    <View style={styles.root}>
      <Icon name="time-outline" size={28} color="#00926e" />
      <Text style={styles.title}>No activity yet</Text>
      <Text style={styles.hint}>Top ups, sends, withdrawals, and payments will show up here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { marginTop: 12, fontSize: 16, fontWeight: '800', color: '#111111' },
  hint: { marginTop: 6, fontSize: 13, lineHeight: 18, color: '#6B7280', textAlign: 'center' },
});
