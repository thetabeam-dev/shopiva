import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resetPasswordWithPin, verifyPasswordResetPin } from '../../api/auth';
import { AUTH } from './theme';

export default function ResetPasswordScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const email = String(route.params?.email ?? '').trim().toLowerCase();
  const [pinOpen, setPinOpen] = useState(true);
  const [pin, setPin] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onVerifyPin = useCallback(async () => {
    const code = pin.trim();
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('PIN', 'Enter the 6-digit PIN from your email.');
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyPasswordResetPin(email, code);
      if (!result.ok) {
        Alert.alert('PIN', result.message || 'That PIN is incorrect.');
        return;
      }
      setResetToken(result.resetToken);
      setPinOpen(false);
    } catch (e) {
      Alert.alert('Network error', e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  }, [email, pin]);

  const onReset = useCallback(async () => {
    if (password.length < 8) {
      Alert.alert('Password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password', 'The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await resetPasswordWithPin(email, resetToken, password);
      if (!result.ok) {
        Alert.alert('Could not reset password', result.message || 'Try again.');
        return;
      }
      Alert.alert('Password updated', 'You can log in with your new password.', [
        { text: 'Log in', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e) {
      Alert.alert('Network error', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [confirm, navigation, password, email, resetToken]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top + 12 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>New password</Text>
        <Text style={styles.subtitle}>
          {pinOpen
            ? `A PIN was sent to ${email || 'your email'}. Confirm it to continue.`
            : 'Choose a new password for your account.'}
        </Text>

        {!pinOpen ? (
          <>
            <Text style={styles.label}>New password</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={AUTH.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!submitting}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((prev) => !prev)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={AUTH.textMuted}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor={AUTH.textMuted}
              secureTextEntry={!showPassword}
              value={confirm}
              onChangeText={setConfirm}
              editable={!submitting}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={onReset}
              disabled={submitting}
              activeOpacity={0.9}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Reset password</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={pinOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter PIN</Text>
            <Text style={styles.modalBody}>
              Check {email || 'your email'} for the 6-digit PIN.
            </Text>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={AUTH.textMuted}
              editable={!verifying}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.primaryBtn, verifying && styles.primaryBtnDisabled]}
              onPress={onVerifyPin}
              disabled={verifying}
              activeOpacity={0.9}
            >
              {verifying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Verify PIN</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: AUTH.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },
  brand: { fontSize: 28, fontWeight: '800', color: AUTH.text, letterSpacing: -0.5 },
  subtitle: { marginTop: 10, fontSize: 15, lineHeight: 22, color: AUTH.textMuted },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AUTH.text,
    marginBottom: 8,
    marginTop: 18,
  },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.border,
    paddingHorizontal: 18,
    paddingRight: 48,
    fontSize: 16,
    color: AUTH.text,
    backgroundColor: AUTH.inputBg,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    height: 44,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: AUTH.primary,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.85 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: AUTH.text },
  modalBody: { marginTop: 8, fontSize: 15, lineHeight: 22, color: AUTH.textMuted },
  pinInput: {
    marginTop: 16,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.border,
    paddingHorizontal: 18,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    color: AUTH.text,
  },
});
