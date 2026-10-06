import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { requestPasswordResetPin } from '../../api/auth';
import { AUTH } from './theme';

export default function PasswordRecoveryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onConfirm = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!emailLooksValid) {
      Alert.alert('Email', 'Enter the email on your Deedyte account.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestPasswordResetPin(trimmed);
      if (!result.ok) {
        Alert.alert('Could not confirm email', result.message || 'Try again.');
        return;
      }
      navigation.navigate('ResetPassword', { email: trimmed });
    } catch (e) {
      Alert.alert('Network error', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [email, emailLooksValid, navigation]);

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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to login"
          style={styles.back}
        >
          <Icon name="chevron-back" size={22} color={AUTH.text} />
          <Text style={styles.backText}>Log in</Text>
        </TouchableOpacity>

        <View style={styles.logoBlock}>
          <Image source={require('../../assets/Deedyte.png')} style={{ height: 50, width: 50 }} />
          <Text style={styles.brand}>Reset password</Text>
          <Text style={styles.subtitle}>
            Enter the email on your account. If it matches, we will send a PIN to that inbox.
          </Text>
        </View>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={AUTH.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            editable={!submitting}
          />
          {emailLooksValid ? (
            <View style={styles.checkCircle}>
              <Icon name="checkmark" size={18} color="#000000" />
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
          onPress={onConfirm}
          activeOpacity={0.9}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Confirm email</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: AUTH.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { fontSize: 16, color: AUTH.text, fontWeight: '600' },
  logoBlock: { alignItems: 'center', marginBottom: 28 },
  brand: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '800',
    color: AUTH.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: AUTH.textMuted,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AUTH.text,
    marginBottom: 8,
    marginTop: 8,
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
  checkCircle: {
    position: 'absolute',
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: AUTH.successCheck,
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
});
