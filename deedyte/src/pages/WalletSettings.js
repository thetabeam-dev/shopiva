import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { fetchWallet } from '../api/user';

const BLACK = '#111111';

export default function WalletSettingsScreen() {
  const navigation = useNavigation();
  const [hasPin, setHasPin] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchWallet()
        .then(row => {
          if (!cancelled) setHasPin(Boolean(row?.has_pin));
        })
        .catch(() => {
          if (!cancelled) setHasPin(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <View style={styles.menuCard}>
        <SettingsRow
          icon="keypad-outline"
          title="Create new PIN"
          hint={hasPin ? 'This wallet already has a PIN.' : 'Set a 4-digit PIN for sends and withdrawals.'}
          disabled={hasPin}
          onPress={() => navigation.navigate('Wallet-pin')}
        />
        <View style={styles.menuDivider} />
        <SettingsRow
          icon="mail-outline"
          title="PIN recovery"
          hint="Confirm your email, then use the PIN we send to choose a new wallet PIN."
          onPress={() => navigation.navigate('Wallet-pin-recovery')}
        />
        <View style={styles.menuDivider} />
        <SettingsRow
          icon="lock-closed-outline"
          title="Change PIN"
          hint={
            hasPin
              ? 'Enter the current PIN, then choose a new 4-digit PIN.'
              : 'Create a PIN before you can change it.'
          }
          disabled={!hasPin}
          onPress={() => navigation.navigate('Wallet-pin-change')}
        />
      </View>
    </View>
  );
}

function SettingsRow({ icon, title, hint, disabled, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && !disabled && styles.menuRowPressed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Icon name={icon} size={22} color={disabled ? '#9CA3AF' : BLACK} />
      <View style={styles.menuText}>
        <Text style={[styles.menuTitle, disabled && styles.muted]}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Icon name="chevron-forward" size={20} color={disabled ? '#D1D5DB' : BLACK} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F4F5', padding: 16 },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  menuRowPressed: { backgroundColor: '#FAFAFA' },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '500', color: BLACK },
  hint: { marginTop: 4, fontSize: 12, lineHeight: 16, color: '#6B7280' },
  muted: { color: '#9CA3AF' },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECECEC',
    marginLeft: 48,
  },
});
