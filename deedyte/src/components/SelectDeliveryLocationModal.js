import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
const SELECTED_BG = '#E8F3EE';

/**
 * @param {{
 *   visible: boolean;
 *   onClose: () => void;
 *   locations: Array<{ key: string; name: string; fee: number; checkoutFee?: number }>;
 *   selectedKey?: string | null;
 *   onSelect: (key: string) => void;
 *   onContinue: () => void;
 *   loading?: boolean;
 *   emptyMessage?: string;
 *   continueLabel?: string;
 * }} props
 */
export default function SelectDeliveryLocationModal({
  visible,
  onClose,
  locations,
  selectedKey,
  onSelect,
  onContinue,
  loading = false,
  emptyMessage = 'This vendor has not set delivery locations yet.',
  continueLabel = 'Continue to checkout',
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const rows = Array.isArray(locations) ? locations : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((loc) => loc.name.toLowerCase().includes(q));
  }, [rows, query]);
  const selected = rows.find((loc) => loc.key === selectedKey) || null;
  const selectedFee = selected
    ? Number.isFinite(Number(selected.checkoutFee))
      ? Number(selected.checkoutFee)
      : Number(selected.fee) || 0
    : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close delivery locations" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
              <Icon name="chevron-back" size={24} color={TEXT} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select delivery location</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} color={TEXT} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Icon name="search-outline" size={18} color="#8A9194" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search for a state..."
              placeholderTextColor="#9AA0A3"
              style={styles.searchInput}
              autoCorrect={false}
              accessibilityLabel="Search for a state"
            />
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={BRAND} />
              <Text style={styles.loadingText}>Loading delivery locations...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filtered.length === 0 ? (
                <Text style={styles.empty}>{query.trim() ? 'No matching states.' : emptyMessage}</Text>
              ) : (
                filtered.map((loc) => {
                  const active = loc.key === selectedKey;
                  const fee = Number.isFinite(Number(loc.checkoutFee))
                    ? Number(loc.checkoutFee)
                    : Number(loc.fee) || 0;
                  return (
                    <TouchableOpacity
                      key={loc.key}
                      style={[styles.row, active ? styles.rowSelected : null]}
                      onPress={() => onSelect(loc.key)}
                      activeOpacity={0.85}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={styles.rowName}>{loc.name}</Text>
                      <View style={styles.rowRight}>
                        <Text style={[styles.rowFee, active ? styles.rowFeeActive : null]}>{formatNaira(fee)}</Text>
                        <View style={[styles.radio, active ? styles.radioOn : null]}>
                          {active ? <View style={styles.radioDot} /> : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          <View style={styles.footer}>
            {selected ? (
              <View style={styles.selectedBanner}>
                <View style={styles.selectedIcon}>
                  <Icon name="car-outline" size={20} color={BRAND} />
                </View>
                <View style={styles.selectedCopy}>
                  <Text style={styles.selectedLabel}>Delivery to {selected.name}</Text>
                  <Text style={styles.selectedFee}>{formatNaira(selectedFee)}</Text>
                </View>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.continueBtn, !selected ? styles.continueBtnDisabled : null]}
              onPress={onContinue}
              disabled={!selected}
              accessibilityRole="button"
              accessibilityLabel={continueLabel}
            >
              <Text style={styles.continueText}>{continueLabel}</Text>
            </TouchableOpacity>
            <Text style={styles.footerHint}>The delivery fee will be added to your total at checkout.</Text>
          </View>
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
    maxHeight: '92%',
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C5C8CB',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
    backgroundColor: '#FAFBFB',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT,
    paddingVertical: 0,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: MUTED,
    fontSize: 15,
  },
  empty: {
    paddingVertical: 28,
    textAlign: 'center',
    color: MUTED,
    fontSize: 14,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
  },
  rowSelected: {
    backgroundColor: SELECTED_BG,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowFee: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  rowFeeActive: {
    color: BRAND,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#C5C8CB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: BRAND,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BRAND,
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  selectedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PALE_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCopy: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND,
  },
  selectedFee: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '800',
    color: BRAND,
  },
  continueBtn: {
    backgroundColor: BRAND,
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.45,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footerHint: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    color: MUTED,
  },
});
