import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import zones from '../json/zones.json';

const BRAND = '#00926e';

export const NIGERIAN_STATES = zones.map((zone) => zone.name);

/** @param {string} raw */
export function matchNigerianState(raw) {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+state$/, '')
    .replace(/\s+/g, ' ');
  if (!value) return '';
  if (value === 'fct' || value === 'abuja' || value === 'federal capital territory') {
    return zones.find((zone) => zone.name === 'FCT')?.name ?? '';
  }
  return zones.find((zone) => zone.name.toLowerCase() === value)?.name ?? '';
}

/**
 * Bottom sheet of Nigerian states.
 * @param {{ visible: boolean; selected?: string; onClose: () => void; onSelect: (state: string) => void }} props
 */
export default function NigerianStatePickerModal({ visible, selected, onClose, onSelect }) {
  const insets = useSafeAreaInsets();
  const current = matchNigerianState(selected) || String(selected ?? '');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close state list" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Select state</Text>
          <FlatList
            data={NIGERIAN_STATES}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item === current;
              return (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{item}</Text>
                  {isSelected ? <Icon name="checkmark" size={18} color={BRAND} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    maxHeight: '70%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginTop: 10,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111111', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowText: { fontSize: 16, color: '#111111' },
  rowTextSelected: { color: BRAND, fontWeight: '700' },
});
