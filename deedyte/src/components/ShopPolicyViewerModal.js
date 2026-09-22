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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatNaira } from '../utils/formatNaira';

const BRAND = '#0D4F3C';
const TEXT = '#17191A';
const MUTED = '#6B7073';
const BORDER = '#E6E9E8';
const PALE_GREEN = '#EEF6F2';

/**
 * @param {{
 *   visible: boolean;
 *   onClose: () => void;
 *   title: string;
 *   clauses: { title: string; content: string }[];
 *   locations?: { name: string; fee?: number }[];
 *   deliveryMethod?: { title?: string; description?: string };
 *   emptyMessage?: string;
 *   loading?: boolean;
 * }} props
 */
export default function ShopPolicyViewerModal({
  visible,
  onClose,
  title,
  clauses,
  locations,
  deliveryMethod,
  emptyMessage,
  loading = false,
}) {
  const insets = useSafeAreaInsets();
  const hasClauses = Array.isArray(clauses) && clauses.some((c) => c.title || c.content);
  const locationRows = Array.isArray(locations) ? locations.filter((l) => l && l.name) : [];
  const isDelivery = /delivery/i.test(title || '') || locationRows.length > 0;
  const sheetTitle = isDelivery ? 'Delivery details' : title;
  const sheetSubtitle = isDelivery
    ? 'See where this vendor delivers and the delivery fee.'
    : 'Review this vendor\'s shop policy before placing your order.';
  const methodTitle = deliveryMethod?.title || 'Vendor delivery';
  const methodBody = deliveryMethod?.description || 'Delivered directly by the vendor.';
  const hasDelivery = locationRows.length > 0;
  const has = isDelivery ? hasDelivery : hasClauses;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close policy" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle} numberOfLines={2}>{sheetTitle}</Text>
              <Text style={styles.headerSubtitle}>{sheetSubtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={23} color={TEXT} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={BRAND} />
                <Text style={styles.loadingText}>Loading delivery details...</Text>
              </View>
            ) : !has ? (
              <View style={styles.emptyCard}>
                <Icon name={isDelivery ? 'location-outline' : 'document-text-outline'} size={22} color={BRAND} />
                <Text style={styles.empty}>{emptyMessage || 'This shop has not added details for this policy yet.'}</Text>
              </View>
            ) : (
              <>
                {isDelivery ? (
                  <>
                    <View style={styles.sectionHeading}>
                      <Icon name="location-outline" size={22} color={BRAND} />
                      <View style={styles.sectionCopy}>
                        <Text style={styles.sectionTitle}>Available locations</Text>
                        <Text style={styles.sectionSubtitle}>This vendor delivers to the following states.</Text>
                      </View>
                    </View>
                    <View style={styles.locationList}>
                      {locationRows.map((loc) => (
                        <View key={loc.name} style={styles.locationRow}>
                          <Text style={styles.locationTitle}>{loc.name}</Text>
                          <View style={styles.locationRight}>
                            {loc.fee != null && Number.isFinite(Number(loc.fee)) ? (
                              <Text style={styles.locationFee}>{formatNaira(loc.fee)}</Text>
                            ) : null}
                            <Icon name="chevron-forward" size={18} color="#8A9194" />
                          </View>
                        </View>
                      ))}
                    </View>
                    <View style={styles.infoNotice}>
                      <Icon name="information-circle-outline" size={20} color={BRAND} />
                      <Text style={styles.noticeText}>
                        Delivery fee depends on your selected location and will be added at checkout.
                      </Text>
                    </View>
                    <View style={[styles.sectionHeading, styles.methodHeading]}>
                      <Icon name="car-outline" size={22} color={BRAND} />
                      <View style={styles.sectionCopy}>
                        <Text style={styles.sectionTitle}>How it's delivered</Text>
                        <Text style={styles.sectionSubtitle}>This vendor uses the following delivery method.</Text>
                      </View>
                    </View>
                    <View style={styles.methodCard}>
                      <View style={styles.methodIcon}>
                        <Icon name="storefront-outline" size={22} color={BRAND} />
                      </View>
                      <View style={styles.clauseCopy}>
                        <Text style={styles.clauseTitle}>{methodTitle}</Text>
                        <Text style={styles.clauseBody}>{methodBody}</Text>
                      </View>
                    </View>
                    <View style={styles.notice}>
                      <Icon name="shield-checkmark-outline" size={20} color={BRAND} />
                      <Text style={styles.noticeText}>
                        Your payment is protected by Shopiva's escrow until you receive your order.
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.sectionHeading}>
                      <Icon name="shield-checkmark-outline" size={22} color={BRAND} />
                      <View style={styles.sectionCopy}>
                        <Text style={styles.sectionTitle}>Shop policy</Text>
                        <Text style={styles.sectionSubtitle}>Provided by this vendor</Text>
                      </View>
                    </View>
                    <View style={styles.clauseList}>
                      {clauses.map((c, i) => (
                        <View key={`${i}-${c.title}`} style={styles.clauseRow}>
                          <View style={styles.clauseIcon}>
                            <Icon name="checkmark-circle-outline" size={20} color={BRAND} />
                          </View>
                          <View style={styles.clauseCopy}>
                            {c.title ? <Text style={styles.clauseTitle}>{c.title}</Text> : null}
                            {c.content ? <Text style={styles.clauseBody}>{c.content}</Text> : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C5C8CB',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 12,
  },
  headerCopy: { flex: 1 },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
  },
  scroll: {
    maxHeight: 570,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  empty: {
    flex: 1,
    fontSize: 15,
    color: MUTED,
    lineHeight: 22,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: PALE_GREEN,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: MUTED,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  sectionCopy: { flex: 1 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  clauseList: {
    gap: 8,
    marginBottom: 16,
  },
  locationList: {
    gap: 8,
    marginBottom: 12,
  },
  locationRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F3F4F4',
  },
  locationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  locationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationFee: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND,
  },
  clauseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FAFBFB',
  },
  clauseIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALE_GREEN,
    marginRight: 10,
  },
  clauseCopy: {
    flex: 1,
  },
  clauseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 2,
  },
  clauseBody: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  methodHeading: {
    marginTop: 20,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F3F4F4',
    marginBottom: 12,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALE_GREEN,
    marginRight: 12,
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: PALE_GREEN,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: PALE_GREEN,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#46504B',
  },
});
