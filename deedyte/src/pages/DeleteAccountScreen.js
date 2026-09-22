import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteAccount } from '../api/user';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../context/ProfileContext';
import { clearAllDeedyteStorage } from '../auth/session';
import { disconnectChatSocket } from '../socket/chatSocket';
import { navigate } from '../navigation';
import { runOAuthInPopup } from '../auth/oauthInApp';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DANGER = '#C62828';
const DANGER_BG = '#FDECEC';
const DANGER_BG_DARK = '#4E1616';
const TEXT_DARK = '#101114';
const TEXT_LIGHT = '#F3F4F6';
const MUTED_DARK = '#656A73';
const MUTED_LIGHT = '#B5BCC8';
const BORDER_LIGHT = '#E3E6EB';
const BORDER_DARK = '#3A3F47';
const CARD_LIGHT = '#FFFFFF';
const CARD_DARK = '#1B1E24';
const PAGE_LIGHT = '#F7F7F8';
const PAGE_DARK = '#121418';

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const { user } = useProfile();
  const { signOut } = useAuth();

  const provider = useMemo(() => {
    const raw = String(user?.raw?.provider ?? 'local').trim().toLowerCase();
    if (raw === 'google' || raw === 'facebook' || raw === 'apple') return raw;
    return 'local';
  }, [user?.raw?.provider]);

  const usesPassword = provider === 'local';
  const [acknowledged, setAcknowledged] = useState(false);
  const [password, setPassword] = useState('');
  const [oauthReauthed, setOauthReauthed] = useState(false);
  const [oauthReauthedAt, setOauthReauthedAt] = useState('');
  const [oauthReauthToken, setOauthReauthToken] = useState('');
  const [oauthBusy, setOauthBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = acknowledged && (usesPassword ? password.trim().length > 0 : oauthReauthed);

  const onDelete = () => {
    if (!canSubmit || submitting) return;
    Alert.alert('Delete Account?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onConfirmDelete().catch(() => {});
        },
      },
    ]);
  };

  const onConfirmDelete = async () => {
    setSubmitting(true);
    try {
      const payload = usesPassword
        ? { password: password.trim() }
        : {
            oauthProvider: provider,
            oauthReauthenticated: true,
            oauthReauthenticatedAt: oauthReauthedAt,
            oauthReauthToken,
          };

      const result = await deleteAccount(payload);
      if (!result.ok) {
        Alert.alert('Could not delete account', result.message || 'Please try again.');
        return;
      }

      Alert.alert('Account deleted', 'Your account has been permanently deleted.', [
        {
          text: 'OK',
          onPress: () => {
            finalizeLocalLogout().catch(() => {});
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Could not delete account', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const finalizeLocalLogout = async () => {
    try {
      disconnectChatSocket();
    } catch {
      // no-op
    }
    try {
      await AsyncStorage.clear();
    } catch {
      // no-op
    }
    try {
      await clearAllDeedyteStorage();
    } catch {
      // no-op
    }
    try {
      await signOut();
    } catch {
      // no-op
    }
    navigate('Login');
  };

  const onOAuthReauthenticate = async () => {
    if (oauthBusy || submitting) return;
    setOauthBusy(true);
    try {
      const out = await runOAuthInPopup(provider);
      if (!out.ok) {
        if (out.cancelled) return;
        Alert.alert('Re-authentication', out.message || 'Re-authentication was not completed.');
        return;
      }
      setOauthReauthed(true);
      setOauthReauthedAt(new Date().toISOString());
      setOauthReauthToken(String(out.token ?? ''));
      Alert.alert('Re-authentication complete', `You can now delete your ${provider} account.`);
    } catch (e) {
      Alert.alert('Re-authentication', e instanceof Error ? e.message : String(e));
    } finally {
      setOauthBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: dark ? PAGE_DARK : PAGE_LIGHT }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 20) + 20,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* <Text
          style={[styles.title, { color: dark ? TEXT_LIGHT : TEXT_DARK }]}
          accessibilityRole="header"
        >
          Delete Account
        </Text> */}

        <View
          style={[
            styles.warningCard,
            {
              backgroundColor: dark ? DANGER_BG_DARK : DANGER_BG,
              borderColor: dark ? '#7C3030' : '#F3BBBB',
            },
          ]}
          accessibilityLabel="Account deletion warning"
          accessibilityRole="summary"
        >
          <Text style={[styles.warningLead, { color: dark ? TEXT_LIGHT : TEXT_DARK }]}>Deleting your account is permanent and cannot be undone.</Text>
          <Text style={[styles.warningBody, { color: dark ? MUTED_LIGHT : MUTED_DARK }]}>This action will permanently remove:</Text>
          <View style={styles.warningList}>
            {[
              'Profile information',
              'Addresses',
              'Saved payment methods (if any)',
              'Wishlist',
              'Notifications',
              'Shopping history where legally allowed',
              'Any other personal data',
            ].map((item) => (
              <Text key={item} style={[styles.warningItem, { color: dark ? MUTED_LIGHT : MUTED_DARK }]}>• {item}</Text>
            ))}
          </View>
          <Text style={[styles.legalText, { color: dark ? TEXT_LIGHT : TEXT_DARK }]}>Some transaction records may be retained where required by law.</Text>
        </View>

        <View
          style={[
            styles.formCard,
            {
              backgroundColor: dark ? CARD_DARK : CARD_LIGHT,
              borderColor: dark ? BORDER_DARK : BORDER_LIGHT,
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [styles.checkboxRow, pressed && { opacity: 0.85 }]}
            onPress={() => setAcknowledged((prev) => !prev)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
            accessibilityLabel="I understand this action is permanent"
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: acknowledged ? DANGER : dark ? BORDER_DARK : BORDER_LIGHT,
                  backgroundColor: acknowledged ? DANGER : 'transparent',
                },
              ]}
            >
              {acknowledged ? <Icon name="checkmark" size={16} color="#FFFFFF" /> : null}
            </View>
            <Text style={[styles.checkboxText, { color: dark ? TEXT_LIGHT : TEXT_DARK }]}>I understand this action is permanent.</Text>
          </Pressable>

          {usesPassword ? (
            <View style={styles.inputBlock}>
              <Text style={[styles.label, { color: dark ? MUTED_LIGHT : MUTED_DARK }]}>Confirm Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!submitting}
                placeholder="Enter your password"
                placeholderTextColor={dark ? '#8F96A3' : '#9DA3AE'}
                style={[
                  styles.input,
                  {
                    color: dark ? TEXT_LIGHT : TEXT_DARK,
                    borderColor: dark ? BORDER_DARK : BORDER_LIGHT,
                    backgroundColor: dark ? '#171A1F' : '#FFFFFF',
                  },
                ]}
                accessibilityLabel="Confirm Password"
              />
            </View>
          ) : (
            <View style={styles.inputBlock}>
              <Text style={[styles.label, { color: dark ? MUTED_LIGHT : MUTED_DARK }]}>Re-authentication required</Text>
              <Text style={[styles.oauthHelp, { color: dark ? MUTED_LIGHT : MUTED_DARK }]}>Re-authenticate with {provider} before deleting your account.</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.reauthBtn,
                  {
                    borderColor: oauthReauthed ? DANGER : dark ? BORDER_DARK : BORDER_LIGHT,
                    backgroundColor: oauthReauthed ? (dark ? '#6A2121' : '#FFE5E5') : 'transparent',
                  },
                  pressed && { opacity: 0.88 },
                ]}
                disabled={submitting || oauthBusy}
                onPress={() => {
                  onOAuthReauthenticate().catch(() => {});
                }}
                accessibilityRole="button"
                accessibilityLabel={`Re-authenticate with ${provider}`}
              >
                <Text style={[styles.reauthBtnText, { color: dark ? TEXT_LIGHT : TEXT_DARK }]}>
                  {oauthBusy
                    ? 'Re-authenticating...'
                    : oauthReauthed
                      ? `Re-authenticated with ${provider}`
                      : `Re-authenticate with ${provider}`}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.deleteBtn,
            {
              backgroundColor: canSubmit && !submitting ? DANGER : '#D6D9DE',
              opacity: pressed && canSubmit && !submitting ? 0.9 : 1,
            },
          ]}
          disabled={!canSubmit || submitting}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit || submitting }}
          accessibilityLabel="Delete My Account"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.deleteBtnText}>Delete My Account</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 14,
  },
  warningCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warningLead: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 10,
  },
  warningBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  warningList: {
    marginBottom: 10,
  },
  warningItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  legalText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  formCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  inputBlock: {
    marginTop: 14,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  oauthHelp: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  reauthBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  reauthBtnText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteBtn: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
