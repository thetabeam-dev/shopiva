import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WINDOW_H = Dimensions.get('window').height;

/**
 * Bottom sheet menu (shop list card or product detail ⋮).
 *
 * @param {{
 *   visible: boolean;
 *   onClose: () => void;
 *   title: string;
 *   subtitle?: string;
 *   headerImageUri?: string;
 *   fallbackLetter?: string;
 *   onVisitShop: () => void;
 *   onFollow: () => void;
 *   onNotInterested: () => void;
 *   onReport: () => void;
 *   reportLabel?: string;
 *   onDeliveryPolicy?: () => void;
 *   onViewShopPolicy?: () => void;
 * }} props
 */
export function ShopOverflowMenu({
  visible,
  onClose,
  title,
  subtitle = '',
  headerImageUri = '',
  fallbackLetter = 'S',
  onVisitShop,
  onFollow,
  onNotInterested,
  onReport,
  reportLabel = 'Report shop',
  onDeliveryPolicy,
  onViewShopPolicy,
}) {
  const insets = useSafeAreaInsets();
  if (!visible) {
    return null;
  }

  const letter =
    String(fallbackLetter || 'S')
      .trim()
      .charAt(0)
      .toUpperCase() || 'S';
  const uri = String(headerImageUri || '').trim();
  const sub = String(subtitle || '').trim();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerMain}>
              <View style={styles.avatarOuter}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={styles.avatarImg}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarLetter}>{letter}</Text>
                )}
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.title} numberOfLines={2}>
                  {title || 'Shop'}
                </Text>
                {sub ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {sub}
                  </Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeWrap}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <View style={styles.closeCircle}>
                <Icon name="close" size={20} color="#5F6368" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.menuBlock}>
            <TouchableOpacity
              style={styles.row}
              onPress={onVisitShop}
              activeOpacity={0.75}
            >
              <Icon
                name="storefront-outline"
                size={22}
                color="#202124"
                style={styles.rowIcon}
              />
              <Text style={styles.rowLabel}>Visit shop</Text>
            </TouchableOpacity>
            {/* {typeof onViewShopPolicy === 'function' ? (
              <>
                <View style={styles.rowSep} />
                <TouchableOpacity
                  style={styles.row}
                  onPress={onViewShopPolicy}
                  activeOpacity={0.75}
                >
                  <Icon
                    name="document-text-outline"
                    size={22}
                    color="#202124"
                    style={styles.rowIcon}
                  />
                  <Text style={styles.rowLabel}>View shop policy</Text>
                </TouchableOpacity>
              </>
            ) : null} */}
            {typeof onDeliveryPolicy === 'function' ? (
              <>
                <View style={styles.rowSep} />
                <TouchableOpacity
                  style={styles.row}
                  onPress={onDeliveryPolicy}
                  activeOpacity={0.75}
                >
                  <Icon
                    name="car-outline"
                    size={22}
                    color="#202124"
                    style={styles.rowIcon}
                  />
                  <Text style={styles.rowLabel}>Delivery details</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <View style={styles.rowSep} />
            {/* <TouchableOpacity
              style={styles.row}
              onPress={onNotInterested}
              activeOpacity={0.75}
            >
              <Icon
                name="thumbs-down-outline"
                size={22}
                color="#202124"
                style={styles.rowIcon}
              />
              <Text style={styles.rowLabel}>Not interested</Text>
            </TouchableOpacity> */}
            <View style={styles.rowSep} />
            {/* <TouchableOpacity style={styles.row} onPress={onReport} activeOpacity={0.75}>
              <Icon name="alert-circle-outline" size={22} color="#C62828" style={styles.rowIcon} />
              <Text style={[styles.rowLabel, styles.rowLabelDanger]}>{reportLabel}</Text>
            </TouchableOpacity> */}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 6,
    maxHeight: Math.round(WINDOW_H * 0.55),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 10,
    backgroundColor: '#D8D8D8',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  avatarOuter: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#E8E8E8',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: '700',
    color: '#202124',
  },
  headerTextCol: {
    flex: 1,
    marginLeft: 14,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#5F6368',
  },
  closeWrap: {
    paddingTop: 2,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F3F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBlock: {
    marginTop: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowIcon: {
    marginRight: 16,
    width: 26,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
    fontWeight: '500',
  },
  rowLabelDanger: {
    color: '#C62828',
  },
  rowSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8EAED',
    marginLeft: 42,
  },
});
