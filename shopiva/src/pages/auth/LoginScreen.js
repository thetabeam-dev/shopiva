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
import { useAuth } from '../../hooks/useAuth';
import { loginWithPassword } from '../../api/auth';
import { completeAuthAndGoHome } from '../../auth/completeAuth';
import { runOAuthInPopup } from '../../auth/oauthInApp';
import { AUTH } from './theme';

export default function LoginScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { enterGuestMode } = useAuth();
  const allowSkip = route?.params?.allowSkip !== false;
  const role = route?.params?.intentRole;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const goSignUp = useCallback(
    () => navigation.navigate('SignUp', { allowSkip, intentRole: role }),
    [navigation, allowSkip, role],
  );

  const onSocial = useCallback(
    async (provider) => {
      setOauthBusy(true);
      try {
        const out = await runOAuthInPopup(provider);
        if (!out.ok) {
          if (out.external) return;
          if (out.cancelled) return;
          if (out.message) Alert.alert('Sign-in', out.message);
          return;
        }
        await completeAuthAndGoHome(out.token, null);
      } catch (e) {
        Alert.alert('Sign-in', e instanceof Error ? e.message : String(e));
      } finally {
        setOauthBusy(false);
      }
    },
    [],
  );

  const onLogin = useCallback(async () => {
    const login = email.trim();
    const pwd = password;
    if (!login || !pwd) {
      Alert.alert('Missing fields', 'Enter email or username and password.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await loginWithPassword(login, pwd);
      if (result.ok && result.token) {
        await completeAuthAndGoHome(result.token, result.user ?? null);
        return;
      }
      if (result.needsVerification && result.email) {
        navigation.navigate('VerifyCode', {
          email: result.email,
          flow: 'login',
        });
        return;
      }
      Alert.alert('Could not log in', result.message || 'Check your credentials and try again.');
    } catch (e) {
      Alert.alert('Network error', e instanceof Error ? (e.message) : (String(e)));
      // Alert.alert('Network error', JSON.stringify((e)));
    } finally {
      setSubmitting(false);
    }
  }, [navigation, email, password]);

  const onSkipAuth = useCallback(async () => {
    try {
      await enterGuestMode();
    } catch (e) {
      Alert.alert('Skip sign-in', e instanceof Error ? e.message : String(e));
    }
  }, [enterGuestMode]);

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
        <View style={styles.logoBlock}>
          <View style={styles.logoMark}>
            <Image
              source={require('../../assets/Deedyte.png')}
              style={{ height: 50, width: 50 }}
            />
          </View>
          <Text style={styles.brand}>Deedyte</Text>
        </View>

        {/* <TouchableOpacity
          style={[styles.socialBtn, oauthBusy && styles.socialBtnBusy]}
          onPress={() => onSocial('google')}
          activeOpacity={0.85}
          disabled={oauthBusy}
        >
          <Icon name="logo-google" size={22} color="#000000" />
          <Text style={styles.socialBtnText}>Continue with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.socialBtn, oauthBusy && styles.socialBtnBusy]}
          onPress={() => onSocial('facebook')}
          activeOpacity={0.85}
          disabled={oauthBusy}
        >
          <Icon name="logo-facebook" size={22} color="#000000" />
          <Text style={styles.socialBtnText}>Continue with Facebook</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.socialBtn, oauthBusy && styles.socialBtnBusy]}
          onPress={() => onSocial('apple')}
          activeOpacity={0.85}
          disabled={oauthBusy}
        >
          <Icon name="logo-apple" size={24} color="#000000" />
          <Text style={styles.socialBtnText}>Continue with Apple</Text>
        </TouchableOpacity> */}

        <Text style={styles.label}>Email or username</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Email or username"
            placeholderTextColor={AUTH.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!submitting && !oauthBusy}
          />
          {emailLooksValid ? (
            <View style={styles.checkCircle}>
              <Icon name="checkmark" size={18} color="#000000" />
            </View>
          ) : null}
        </View>

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, styles.inputSingle]}
          placeholder="Enter Your Password"
          placeholderTextColor={AUTH.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!submitting && !oauthBusy}
        />

        <TouchableOpacity
          style={[styles.primaryBtn, (submitting || oauthBusy) && styles.primaryBtnDisabled]}
          onPress={onLogin}
          activeOpacity={0.9}
          disabled={submitting || oauthBusy}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Log in</Text>
          )}
        </TouchableOpacity>

        {allowSkip ? (
          <TouchableOpacity
            style={[styles.skipBtn, (submitting || oauthBusy) && styles.skipBtnDisabled]}
            onPress={onSkipAuth}
            activeOpacity={0.9}
            disabled={submitting || oauthBusy}
          >
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.footer}>
          Don&apos;t Have Account?{' '}
          <Text style={styles.footerLink} onPress={goSignUp}>
            Please Sign up.
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: AUTH.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoMark: {
    marginBottom: 8,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: AUTH.text,
    letterSpacing: -0.5,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.socialBorder,
    marginBottom: 12,
    gap: 10,
  },
  socialBtnBusy: {
    opacity: 0.55,
  },
  socialBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: AUTH.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AUTH.text,
    marginBottom: 8,
    marginTop: 18,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
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
  inputSingle: {
    paddingRight: 18,
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
  primaryBtnDisabled: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  skipBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: AUTH.border,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnDisabled: {
    opacity: 0.65,
  },
  skipBtnText: {
    color: AUTH.text,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    marginTop: 28,
    textAlign: 'center',
    fontSize: 15,
    color: AUTH.text,
    lineHeight: 22,
  },
  footerLink: {
    color: AUTH.link,
    fontWeight: '700',
  },
});
