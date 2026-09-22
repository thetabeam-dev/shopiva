import { Pressable, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';

/**
 * Floating cart control for full-bleed screens (e.g. Home hero).
 */
export function HomeStackCartFab() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, signOut } = useAuth();
  const loggedIn = isAuthenticated;

  return (
    <Pressable
      onPress={() => {
        if (loggedIn) {
          navigation.navigate('Cart');
        } else {
          void signOut();
        }
      }}
      style={[styles.fab, { top: insets.top + 8 }]}
      accessibilityRole="button"
      accessibilityLabel={loggedIn ? 'Open cart' : 'Login'}
    >
      {loggedIn ? <Icon name="cart-outline" size={26} color="#000000" /> : <Text style={styles.loginText}>Login</Text>}
    </Pressable>
  );
}

/** Inline cart icon for headers / toolbars. Navigates to the Home stack screen `cart`. */
export function HomeStackCartIconButton({
  color = '#000000',
  size = 24,
  hitSlop = { top: 12, bottom: 12, left: 12, right: 12 },
  style,
}) {
  const navigation = useNavigation();
  const { isAuthenticated, signOut } = useAuth();
  const loggedIn = isAuthenticated;

  return (
    <Pressable
      onPress={() => {
        if (loggedIn) {
          navigation.navigate('Cart');
        } else {
          void signOut();
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={loggedIn ? 'Open cart' : 'Login'}
      hitSlop={hitSlop}
      style={[styles.inlineBtn, !loggedIn && styles.loginBtn, style]}
    >
      {loggedIn ? (
        <Icon name="cart-outline" size={size} color={color} />
      ) : (
        <Text style={styles.loginText}>Login</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 14,
    zIndex: 3,
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  inlineBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtn: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#00926e',
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
