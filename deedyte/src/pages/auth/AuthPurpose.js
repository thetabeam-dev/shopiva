import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { getCustomerAccess } from '../../api/user';
import { AUTH } from './theme';

/**
 * Pre-auth role choice (customer vs vendor).
 * “Almost there” runs only after signup (not after login). Skipping login = guest = no “Almost there”.
 */
export default function AuthPurposeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { setPreAuthChoice } = useAuth();
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [accessNotice, setAccessNotice] = useState(
    /** @type {{ title: string; message: string } | null} */ (null),
  );

  const goCustomer = useCallback(async () => {
    if (checkingCustomer) return;
    setCheckingCustomer(true);
    try {
      const access = await getCustomerAccess();
      if (!access.enabled) {
        setAccessNotice({
          title: access.title || 'Shopping Is Coming Soon!',
          message: access.message,
        });
        return;
      }
      await setPreAuthChoice('customer');
      navigation.replace('Login', { allowSkip: true, intentRole: 'customer' });
    } catch (e) {
      setAccessNotice({
        title: 'Customer access',
        message: e instanceof Error ? e.message : 'Could not check customer access.',
      });
    } finally {
      setCheckingCustomer(false);
    }
  }, [checkingCustomer, navigation, setPreAuthChoice]);

  const goVendor = useCallback(() => {
    void setPreAuthChoice('vendor');
    navigation.replace('Login', { allowSkip: false, intentRole: 'vendor' });
  }, [navigation, setPreAuthChoice]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>How will you use Deedyte?</Text>
        <Text style={styles.sub}>
          Choose your path. Vendor access requires sign in, while customer browsing can continue as guest.
        </Text>

        <TouchableOpacity
          style={styles.card}
          onPress={goCustomer}
          activeOpacity={0.88}
        >
          <Icon name="bag-handle-outline" size={40} color="#000000" />
          <Text style={styles.cardTitle}>Customer (Buyer)</Text>
          <Text style={styles.cardDesc}>Browse stores and discover products as a customer.</Text>
          <Text style={styles.cardHint}>Login is optional (skip available)</Text>
          {checkingCustomer ? (
            <ActivityIndicator style={styles.cardSpinner} color={AUTH.primary} />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardAlt]}
          onPress={goVendor}
          activeOpacity={0.88}
        >
          <Icon name="storefront-outline" size={40} color="#000000" />
          <Text style={styles.cardTitle}>Vendor (Seller)</Text>
          <Text style={styles.cardDesc}>Set up your shop and manage vendor operations.</Text>
          <Text style={styles.cardHint}>Login is required</Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal
        visible={accessNotice != null}
        transparent
        animationType="fade"
        onRequestClose={() => setAccessNotice(null)}
      >
        <View style={styles.noticeRoot}>
          <Pressable style={styles.noticeBackdrop} onPress={() => setAccessNotice(null)} />
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>{accessNotice?.title}</Text>
            {accessNotice?.message ? (
              <Text style={styles.noticeMessage}>{accessNotice.message}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.noticeButton}
              onPress={() => setAccessNotice(null)}
              activeOpacity={0.88}
            >
              <Text style={styles.noticeButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH.bg,
    paddingHorizontal: 24,
  },
  scroll: {
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: AUTH.text,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: AUTH.textMuted,
    marginBottom: 28,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderColor: AUTH.border,
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    backgroundColor: AUTH.inputBg,
  },
  cardAlt: {
    borderColor: AUTH.primary,
    borderWidth: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AUTH.text,
    marginTop: 12,
  },
  cardDesc: {
    fontSize: 14,
    color: AUTH.textMuted,
    marginTop: 6,
    lineHeight: 20,
  },
  cardHint: {
    fontSize: 12,
    color: AUTH.primary,
    marginTop: 12,
    fontWeight: '600',
  },
  cardSpinner: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  noticeRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noticeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  noticeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AUTH.text,
    marginBottom: 10,
  },
  noticeMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: AUTH.textMuted,
  },
  noticeButton: {
    marginTop: 18,
    backgroundColor: AUTH.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  noticeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
