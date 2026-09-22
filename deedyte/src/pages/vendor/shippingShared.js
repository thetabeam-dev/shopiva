import { StyleSheet, Text, View } from 'react-native';
import { formatNaira } from '../../utils/formatNaira';

export const BRAND = '#00926e';
export const BG = '#F4F5F7';
export const CARD = '#FFFFFF';
export const TEXT = '#111111';
export const MUTED = '#6B7280';
export const BORDER = '#E5E7EB';
export const INPUT_BG = '#FFF';
export const DANGER = '#DC2626';

/** @typedef {'multi_item_discount'} ShippingFeeModel */

export const SHIPPING_FEE_MODELS = [
  {
    id: /** @type {ShippingFeeModel} */ ('multi_item_discount'),
    title: 'Multi-Item Discount',
    description: 'Full price for first item, 50% off from second item onwards.',
    icon: 'pricetags-outline',
    recommended: true,
  },
];

export const DISCOUNT_OPTIONS = [
  { label: '25% (Quarter price)', value: 25 },
  { label: '50% (Half price)', value: 50 },
  { label: '75% (Three-quarter price)', value: 75 },
  { label: '100% (Free)', value: 100 },
];

export const NIGERIA_LOCATIONS = [
  'Abia State',
  'Adamawa State',
  'Akwa Ibom State',
  'Anambra State',
  'Bauchi State',
  'Bayelsa State',
  'Benue State',
  'Borno State',
  'Cross River State',
  'Delta State',
  'Ebonyi State',
  'Edo State',
  'Ekiti State',
  'Enugu State',
  'FCT Abuja',
  'Gombe State',
  'Imo State',
  'Jigawa State',
  'Kaduna State',
  'Kano State',
  'Katsina State',
  'Kebbi State',
  'Kogi State',
  'Kwara State',
  'Lagos State',
  'Nasarawa State',
  'Niger State',
  'Ogun State',
  'Ondo State',
  'Osun State',
  'Oyo State',
  'Plateau State',
  'Rivers State',
  'Sokoto State',
  'Taraba State',
  'Yobe State',
  'Zamfara State',
];

/** @param {string | number} raw */
export function parseAmountInput(raw) {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

/** @param {number} amount */
export function formatAmountInput(amount) {
  if (!amount) return '';
  return Math.round(amount).toLocaleString('en-NG');
}

/**
 * @param {ShippingFeeModel} model
 * @param {number} baseFee
 * @param {number} discountPercent
 */
export function shippingTotalForItemCount(model, baseFee, discountPercent, itemCount) {
  const count = Math.max(0, Math.floor(itemCount));
  const base = Math.max(0, baseFee);
  const discount = Math.min(100, Math.max(0, discountPercent)) / 100;

  if (count <= 0) return 0;

  const additional = Math.max(0, count - 1);
  const discountedUnit = base * (1 - discount);
  return base + additional * discountedUnit;
}

/**
 * @param {ShippingFeeModel} model
 * @param {number} baseFee
 * @param {number} discountPercent
 */
export function buildPreviewLines(model, baseFee, discountPercent) {
  const lines = [];
  for (let count = 1; count <= 4; count += 1) {
    const total = shippingTotalForItemCount(model, baseFee, discountPercent, count);
    let detail = '';

    if (model === 'multi_item_discount' && count > 1) {
      const discountedUnit = baseFee * (1 - discountPercent / 100);
      if (count === 2) {
        detail = ` (${formatNaira(baseFee)} + (${formatNaira(baseFee)} × ${100 - discountPercent}%))`;
      } else {
        detail = ` (${formatNaira(baseFee)} + ${count - 1} × ${formatNaira(discountedUnit)})`;
      }
    }

    lines.push({
      count,
      label: `${count} item${count > 1 ? 's' : ''} in cart`,
      total: formatNaira(total),
      detail,
    });
  }
  return lines;
}

/** @param {{ count: number; label: string; total: string; detail?: string }[]} lines */
export function ShippingPreviewCard({ title = 'How it works (Preview)', lines }) {
  return (
    <View style={sharedStyles.previewCard}>
      <Text style={sharedStyles.previewTitle}>{title}</Text>
      {lines.map((line) => (
        <View key={line.count} style={sharedStyles.previewRow}>
          <Text style={sharedStyles.previewLabel}>{line.label}</Text>
          <Text style={sharedStyles.previewValue}>
            {line.total}
            {line.detail ? <Text style={sharedStyles.previewDetail}>{line.detail}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
    display: 'flex', 
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexDirection: 'row'
  },
  modelCard: {
    backgroundColor: CARD,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 16,
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modelCardSelected: {
    borderColor: BRAND,
    backgroundColor: '#F0FAF6',
  },
  modelIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 7,
    backgroundColor: INPUT_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modelIconWrapSelected: {
    backgroundColor: '#D1F0E6',
  },
  modelBody: {
    flex: 1,
  },
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  recommendedBadge: {
    backgroundColor: BRAND,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recommendedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modelDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginTop: 2,
  },
  radioOuterSelected: {
    borderColor: BRAND,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND,
  },
  previewCard: {
    marginTop: 20,
    backgroundColor: CARD,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  previewLabel: {
    flex: 1,
    fontSize: 13,
    color: MUTED,
    paddingRight: 12,
  },
  previewValue: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'right',
  },
  previewDetail: {
    fontWeight: '400',
    color: MUTED,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    marginBottom: 8,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT,
    paddingVertical: 12,
    
  },
  primaryBtn: {
    backgroundColor: BRAND,
    borderRadius: 7,
    minHeight: 54,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  outlineBtn: {
    borderRadius: 7,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BRAND,
    paddingHorizontal: 16,
    backgroundColor: BRAND
  },
  outlineBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  zoneCard: {
    backgroundColor: CARD,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  zonePin: {
    width: 40,
    height: 40,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  zoneMeta: {
    marginTop: 6,
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F6F1',
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 4,
  },
  locationTagText: {
    color: BRAND,
    fontSize: 13,
    fontWeight: '600',
  },
  dangerBtn: {
    borderRadius: 7,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: DANGER,
    backgroundColor: CARD,
    width: '100%',
    marginTop: 12,
  },
  dangerBtnText: {
    color: DANGER,
    fontSize: 16,
    fontWeight: '700',
  },
  dropdown: {
    backgroundColor: INPUT_BG,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  dropdownSelected: {
    fontSize: 15,
    color: TEXT,
    fontWeight: '600',
  },
});
