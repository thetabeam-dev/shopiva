import { useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatAttributeLabel, getVariantRowPrice, isVariantPurchasable } from '../utils/storefrontProductDetail';
import { formatNaira } from '../utils/formatNaira';

const PURPLE = '#00926e';
const { width: WINDOW_W } = Dimensions.get('window');
const TILE_GAP = 8;
const H_PAD = 16;
const TILE_W = (WINDOW_W - H_PAD * 2 - TILE_GAP) / 2.2;

/**
 * @param {number} index
 */
function variantTitle(index) {
  if (index >= 0 && index < 26) return `Variant ${String.fromCharCode(65 + index)}`;
  return `Variant ${index + 1}`;
}

/**
 * @param {{ label: string; value: string }} p
 */
function SpecTile({ label, value }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Vendor-style variant card (customer PDP): attribute tiles (color, material, size, …) + variant PRICE tile.
 * @param {{
 *   variant: Record<string, unknown>;
 *   index: number;
 *   attrKeys: string[];
 *   selected: boolean;
 *   disabled: boolean;
 *   onPress: () => void;
 * }} p
 */
function VariantCard({ variant, index, attrKeys, selected, disabled, onPress }) {
  const a =
    variant.attributes && typeof variant.attributes === 'object'
      ? /** @type {Record<string, string>} */ (variant.attributes)
      : {};
  const rowPrice = getVariantRowPrice(/** @type {Record<string, unknown>} */ (variant));
  const priceLabel = Number.isFinite(rowPrice) ? formatNaira(rowPrice) : '—';

  return (
    <Pressable
      onPress={() => {
        if (!disabled) onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${variantTitle(index)}, ${priceLabel}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{variantTitle(index)}</Text>
      </View>
      <View style={styles.tileGrid}>
        {attrKeys.map((key) => (
          <SpecTile key={key} label={formatAttributeLabel(key).toUpperCase()} value={a[key] != null && String(a[key]).trim() ? String(a[key]) : '—'} />
        ))}
        <SpecTile label="PRICE" value={priceLabel} />
      </View>
    </Pressable>
  );
}

/**
 * Custom “dropdown” of variant cards (matches vendor dashboard card layout).
 * @param {{
 *   attrKeys: string[];
 *   variants: Record<string, unknown>[];
 *   selectedVariant: Record<string, unknown> | null;
 *   onSelect: (variant: Record<string, unknown>) => void;
 * }} props
 */
function variantMatchesSelection(v, selected, keys) {
  if (!selected || typeof selected !== 'object' || !v || typeof v !== 'object') return false;
  if (String(v.id ?? '') !== String(selected.id ?? '')) return false;
  const va = v.attributes && typeof v.attributes === 'object' ? v.attributes : {};
  const sa = selected.attributes && typeof selected.attributes === 'object' ? selected.attributes : {};
  return keys.every((k) => String(va[k] ?? '') === String(sa[k] ?? ''));
}

/**
 * @param {{ attrKeys: string[]; variants: Record<string, unknown>[]; selectedVariant: Record<string, unknown> | null; onSelect: (variant: Record<string, unknown>) => void }} props
 */
export default function ProductVariantCardPicker({ attrKeys, variants, selectedVariant, onSelect }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => (Array.isArray(variants) ? variants : []), [variants]);

  const summary = useMemo(() => {
    if (!selectedVariant || typeof selectedVariant !== 'object') return '';
    const a =
      selectedVariant.attributes && typeof selectedVariant.attributes === 'object'
        ? /** @type {Record<string, string>} */ (selectedVariant.attributes)
        : {};
    const detailParts = attrKeys
      .map((k) => (a[k] != null && String(a[k]).trim() ? `${formatAttributeLabel(k)}: ${a[k]}` : ''))
      .filter(Boolean);
    const p = getVariantRowPrice(/** @type {Record<string, unknown>} */ (selectedVariant));
    const pricePart = Number.isFinite(p) ? formatNaira(p) : '';
    if (pricePart && detailParts.length) return `${pricePart} · ${detailParts.join(' · ')}`;
    if (pricePart) return pricePart;
    return detailParts.join(' · ');
  }, [selectedVariant, attrKeys]);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel="Open variant options"
        accessibilityHint="Shows all variants with details"
      >
        <Text style={[styles.triggerText, !summary && styles.triggerPlaceholder]} numberOfLines={2}>
          {summary || 'Select an Option (variant)'}
        </Text>
        <Icon name="chevron-down" size={22} color="#333" />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetGrabberWrap}>
              <View style={styles.sheetGrabber} />
            </View>
            <Text style={styles.sheetTitle}>Choose a variant</Text>
            <Text style={styles.sheetSubtitle}>
              Pick color, material, and other options. The price on the product page updates for your selection.
            </Text>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {rows.map((v, index) => {
                const selected = variantMatchesSelection(
                  /** @type {Record<string, unknown>} */ (v),
                  /** @type {Record<string, unknown> | null} */ (selectedVariant),
                  attrKeys,
                );
                const purchasable = isVariantPurchasable(/** @type {Record<string, unknown>} */ (v));
                const id = v && typeof v === 'object' && v.id != null ? String(v.id) : '';
                return (
                  <VariantCard
                    key={`${id}-${index}`}
                    variant={/** @type {Record<string, unknown>} */ (v)}
                    index={index}
                    attrKeys={attrKeys}
                    selected={selected}
                    disabled={!purchasable}
                    onPress={() => {
                      onSelect(/** @type {Record<string, unknown>} */ (v));
                      setOpen(false);
                    }}
                  />
                );
              })}
            </ScrollView>
            <Pressable style={styles.doneBtn} onPress={() => setOpen(false)} accessibilityRole="button">
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    backgroundColor: '#FAFAFA',
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginRight: 8,
  },
  triggerPlaceholder: {
    color: '#888',
    fontWeight: '500',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
  },
  sheetGrabberWrap: { alignItems: 'center', marginBottom: 8 },
  sheetGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  scroll: { maxHeight: Math.round(Dimensions.get('window').height * 0.52) },
  scrollContent: { paddingBottom: 8 },
  card: {
    backgroundColor: '#ECECEF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8D8DC',
    padding: 12,
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: PURPLE,
    borderWidth: 2,
    backgroundColor: 'rgba(0, 146, 110, 0.06)',
  },
  cardDisabled: {
    opacity: 0.48,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2d2d44',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: "space-between",
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDE0E6',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7C93',
    letterSpacing: 0.6,
  },
  tileValue: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  doneBtn: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: PURPLE,
  },
});
