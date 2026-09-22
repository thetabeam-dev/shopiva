/** Shared tokens + field layout for Profile settings sub-screens. */
import { Platform, StyleSheet } from 'react-native';

export const PAGE_BG = '#F7F7F8';
export const CARD = '#FFFFFF';
export const BLACK = '#000000';
export const MUTED = '#8E8E93';
export const BORDER = '#E0E0E0';

export const settingsFormStyles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  intro: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
    marginBottom: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    marginBottom: 20,
  },
  field: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    fontSize: 16,
    color: BLACK,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 0,
    minHeight: 40,
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
  },
  inputSecure: {
    fontSize: 16,
    color: BLACK,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    minHeight: 40,
  },
  readOnlyValue: {
    fontSize: 16,
    color: BLACK,
    paddingVertical: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 14,
  },
  saveBtn: {
    backgroundColor: BLACK,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnPressed: {
    opacity: 0.88,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
