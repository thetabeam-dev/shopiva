import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER = '#075E54';
const MUTED = '#667781';
const BLACK = '#111111';

/**
 * Bottom-sheet style modal when a message fails moderation before send.
 *
 * @param {{ visible: boolean; onDismiss: () => void; variant?: 'single' | 'split' }} props
 */
export function MessagePolicyViolationModal({ visible, onDismiss, variant = 'single' }) {
  const insets = useSafeAreaInsets();

  const isSplit = variant === 'split';
  const bodyText = isSplit
    ? 'Sharing contact details across multiple messages is against platform policy. This activity has been detected and blocked. Keeping conversations on Deedyte protects buyers and sellers and keeps orders traceable.'
    : 'Sharing personal contact details or links to chat outside Deedyte is against our policy. This helps protect both buyers and sellers from fraud and keeps your order and payments traceable on the platform.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Message not sent</Text>
          <Text style={styles.body}>{bodyText}</Text>
          <Text style={styles.warning}>Repeated attempts may lead to account restrictions.</Text>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={styles.ctaText}>Got it</Text>
          </Pressable>
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
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: MUTED,
    marginBottom: 14,
  },
  warning: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#B45309',
    marginBottom: 22,
  },
  cta: {
    backgroundColor: HEADER,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
