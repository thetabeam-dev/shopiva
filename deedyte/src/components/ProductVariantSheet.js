import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
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

const PURPLE = '#00926e';
const VARIANT_SCROLL_MAX_H = Math.round(Dimensions.get('window').height * 0.48);

/**
 * Bottom sheet: pick a variant (inventory row), then confirm — purchase actions stay blocked until confirm.
 * @param {{
 *   visible: boolean;
 *   onClose: () => void;
 *   title?: string;
 *   variants: { id: number; name: string; price: number; currency: string; sku: string; available: number; inStock: boolean; index: number }[];
 *   initialSelectedId: number | null;
 *   initialSelectedIndex: number | null;
 *   onConfirm: (payload: { id: number; index: number }) => void;
 * }} props
 */
export default function ProductVariantSheet({
  visible,
  onClose,
  title = 'Select variant',
  variants,
  initialSelectedId,
  initialSelectedIndex = null,
  onConfirm,
}) {
  const insets = useSafeAreaInsets();
  /** Row index in `variants` — multiple rows can share the same inventory `id`, so we never key selection by id alone. */
  const [highlightedIndex, setHighlightedIndex] = useState(/** @type {number | null} */ (null));

  const rows = useMemo(() => (Array.isArray(variants) ? variants : []), [variants]);

  useEffect(() => {
    if (!visible) {
      setHighlightedIndex(null);
      return;
    }
    if (rows.length === 0) {
      setHighlightedIndex(null);
      return;
    }
    if (rows.length === 1) {
      setHighlightedIndex(0);
      return;
    }
    const pickIndex = (pred) => {
      const i = rows.findIndex(pred);
      return i >= 0 ? i : null;
    };
    let next = /** @type {number | null} */ (null);
    if (
      initialSelectedIndex != null &&
      initialSelectedIndex >= 0 &&
      initialSelectedIndex < rows.length &&
      rows[initialSelectedIndex].inStock &&
      (initialSelectedId == null || rows[initialSelectedIndex].id === initialSelectedId)
    ) {
      next = initialSelectedIndex;
    }
    if (next == null && initialSelectedId != null) {
      next = pickIndex((r) => r.id === initialSelectedId && r.inStock);
    }
    if (next == null) {
      next = pickIndex((r) => r.inStock);
    }
    if (next == null) {
      next = 0;
    }
    setHighlightedIndex(next);
  }, [visible, initialSelectedId, initialSelectedIndex, rows]);

  const highlightedRow =
    highlightedIndex != null && highlightedIndex >= 0 && highlightedIndex < rows.length
      ? rows[highlightedIndex]
      : null;
  const canConfirm = Boolean(highlightedRow?.inStock);

  const handleConfirm = () => {
    if (highlightedIndex == null || !canConfirm) return;
    const row = rows[highlightedIndex];
    if (!row) return;
    onConfirm({ id: row.id, index: row.index });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close variant picker" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView
            style={styles.variantScroll}
            contentContainerStyle={styles.variantScrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {rows.map((item) => {
              const highlighted = highlightedIndex === item.index;
              const disabled = !item.inStock;
              const showPrice = !(item.id < 0 && !item.inStock);
              return (
                <TouchableOpacity
                  key={`${item.id}-${item.index}`}
                  style={[styles.row, highlighted && styles.rowHighlighted, disabled && styles.rowDisabled]}
                  activeOpacity={disabled ? 1 : 0.85}
                  onPress={() => {
                    if (!disabled) setHighlightedIndex(item.index);
                  }}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: highlighted, disabled }}
                >
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowName, disabled && styles.muted]} numberOfLines={3}>
                      {item.name}
                    </Text>
                    {item.sku ? (
                      <Text style={styles.sku} numberOfLines={1}>
                        {item.sku}
                      </Text>
                    ) : null}
                    {item.inStock ? (
                      <Text style={styles.stockMeta} numberOfLines={1}>
                        {item.available} in stock
                      </Text>
                    ) : null}
                    {!item.inStock ? <Text style={styles.oos}>Out of stock</Text> : null}
                  </View>
                  <Text style={[styles.rowPrice, disabled && styles.muted]} accessibilityLabel={`Price ${formatNaira(item.price)}`}>
                    {showPrice ? formatNaira(item.price) : '—'}
                  </Text>
                  {highlighted ? <Icon name="checkmark-circle" size={24} color={PURPLE} style={styles.check} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Confirm variant selection"
            >
              <Text style={[styles.confirmBtnText, !canConfirm && styles.confirmBtnTextDisabled]}>
                {highlightedRow && canConfirm
                  ? `Confirm · ${formatNaira(highlightedRow.price)}`
                  : 'Confirm selection'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  grabberWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  variantScroll: {
    maxHeight: VARIANT_SCROLL_MAX_H,
  },
  variantScrollContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  rowHighlighted: {
    borderColor: PURPLE,
    backgroundColor: '#F0FFF9',
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowLeft: {
    flex: 1,
    marginRight: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  sku: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  stockMeta: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
    fontWeight: '500',
  },
  oos: {
    fontSize: 12,
    color: '#C62828',
    marginTop: 4,
    fontWeight: '600',
  },
  muted: {
    color: '#888',
  },
  rowPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginRight: 8,
  },
  check: {
    marginLeft: 4,
  },
  footer: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8E8',
  },
  confirmBtn: {
    backgroundColor: PURPLE,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#B8D9CE',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  confirmBtnTextDisabled: {
    color: '#F0F0F0',
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
});
