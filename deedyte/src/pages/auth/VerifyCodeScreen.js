import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resendVerificationEmail, verifyEmailCodeWithFallback } from '../../api/auth';
import { completeAuthAndGoHome } from '../../auth/completeAuth';
import { AUTH } from './theme';

const CELL_COUNT = 4;
const CELL_SIZE = 56;

export default function VerifyCodeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const email = route.params?.email ?? 'you@example.com';
  const flow = route.params?.flow;
  const refs = useRef([]);
  const [digits, setDigits] = useState(() => Array(CELL_COUNT).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const setDigitAt = useCallback((index, text) => {
    const c = text.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = c || '';
      return next;
    });
    if (c && index < CELL_COUNT - 1) {
      setTimeout(() => refs.current[index + 1]?.focus?.(), 0);
    }
  }, []);

  const onVerify = useCallback(async () => {
    const code = digits.join('');
    if (code.length !== CELL_COUNT) {
      Alert.alert('Enter code', `Please enter all ${CELL_COUNT} digits.`);
      return;
    }
    setSubmitting(true);
    try {
      const result = await verifyEmailCodeWithFallback(email, code);
      if (result.ok && result.token) {
        await completeAuthAndGoHome(result.token, result.user ?? null, {
          fromSignup: flow === 'signup',
        });
        return;
      }
      Alert.alert('Verification failed', result.message || 'Invalid or expired code.');
    } catch (e) {
      Alert.alert('Network error', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [digits, email, flow]);

  const onResend = useCallback(async () => {
    setResending(true);
    try {
      const result = await resendVerificationEmail(email);
      if (result.ok) {
        Alert.alert('Sent', result.message || 'Check your inbox.');
      } else {
        Alert.alert('Could not resend', result.message || 'Try again later.');
      }
    } catch (e) {
      Alert.alert('Network error', e instanceof Error ? e.message : String(e));
    } finally {
      setResending(false);
    }
  }, [email]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backHit}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="arrow-back" size={26} color="#000000" />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Verify Code</Text>
      <Text style={styles.subtitle}>
        Please enter the code we just sent to email{' '}
        <Text style={styles.emailBold}>{email}</Text>
      </Text>

      <View style={styles.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => {
              refs.current[i] = r;
            }}
            style={[styles.otpCell, d ? styles.otpCellFilled : styles.otpCellEmpty]}
            value={d}
            placeholder="–"
            placeholderTextColor={AUTH.textMuted}
            keyboardType="number-pad"
            maxLength={1}
            onChangeText={(t) => setDigitAt(i, t)}
            selectTextOnFocus
            editable={!submitting}
          />
        ))}
      </View>

      <Text style={styles.resendRow}>
        Don&apos;t Receive OTP?{' '}
        <Text style={[styles.resendLink, resending && styles.resendDisabled]} onPress={resending ? undefined : onResend}>
          {resending ? 'Sending…' : 'Resend code'}
        </Text>
      </Text>

      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
        onPress={onVerify}
        activeOpacity={0.9}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryBtnText}>Verify</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: AUTH.bg,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backHit: {
    padding: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: AUTH.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: AUTH.textMuted,
    lineHeight: 22,
    marginBottom: 32,
  },
  emailBold: {
    fontWeight: '700',
    color: AUTH.text,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  otpCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: AUTH.text,
  },
  otpCellEmpty: {
    backgroundColor: AUTH.otpEmpty,
  },
  otpCellFilled: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: AUTH.border,
  },
  resendRow: {
    textAlign: 'center',
    fontSize: 15,
    color: AUTH.text,
    marginBottom: 28,
  },
  resendLink: {
    color: AUTH.link,
    fontWeight: '700',
  },
  resendDisabled: {
    opacity: 0.5,
  },
  primaryBtn: {
    backgroundColor: AUTH.primary,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
