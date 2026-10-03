import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const BRAND = '#00926e';
const TEXT = '#111111';
const MUTED = '#6B7280';

/**
 * Blocks product creation until shipping model + zones are configured.
 *
 * @param {{
 *   visible: boolean;
 *   busy?: boolean;
 *   hasFeeModel?: boolean;
 *   hasZones?: boolean;
 *   onClose: () => void;
 *   onGoToSetup: () => void;
 * }} props
 */
export default function ShippingSetupRequiredModal({
  visible,
  busy = false,
  hasFeeModel = false,
  hasZones = false,
  onClose,
  onGoToSetup,
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.root} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
          {busy ? (
            <View style={styles.busyWrap}>
              <ActivityIndicator size="large" color={BRAND} />
              <Text style={styles.busyText}>Checking shipping setup…</Text>
            </View>
          ) : (
            <>
              <View style={styles.iconWrap}>
                <Icon name="alert-circle" size={36} color="#B45309" />
              </View>
              <Text style={styles.title}>Complete shipping setup</Text>
              <Text style={styles.body}>
                Before you create a product, finish your shop shipping setup so
                customers can get accurate delivery fees.
              </Text>

              <View style={styles.checklist}>
                <View style={styles.checkRow}>
                  <Icon
                    name={hasFeeModel ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={hasFeeModel ? '#16A34A' : '#B45309'}
                  />
                  <Text style={styles.checkText}>Shipping Model</Text>
                </View>
                <View style={styles.checkRow}>
                  <Icon
                    name={hasZones ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={hasZones ? '#16A34A' : '#B45309'}
                  />
                  <Text style={styles.checkText}>Shipping Zones</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onGoToSetup}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryBtnText}>Go to shop setup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onClose}
                activeOpacity={0.88}
              >
                <Text style={styles.secondaryBtnText}>Not now</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  busyWrap: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  busyText: {
    marginTop: 12,
    fontSize: 15,
    color: MUTED,
    fontWeight: '600',
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 18,
  },
  checklist: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
  },
  primaryBtn: {
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '600',
  },
});
