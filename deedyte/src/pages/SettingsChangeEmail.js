import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loginWithPassword } from '../api/auth';
import { useProfile } from '../context/ProfileContext';
import { MUTED, settingsFormStyles as s } from './settingsFields';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SettingsChangeEmailScreen() {
  const insets = useSafeAreaInsets();
  const { user, saveEmail } = useProfile();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = useCallback(async () => {
    const next = newEmail.trim().toLowerCase();
    if (!next) {
      Alert.alert('Missing email', 'Enter your new email address.');
      return;
    }
    if (!EMAIL_RE.test(next)) {
      Alert.alert('Email', 'Enter a valid email address.');
      return;
    }
    if (!currentPassword) {
      Alert.alert('Verify account', 'Enter your current password to change email.');
      return;
    }
    const current = user?.email?.trim().toLowerCase() ?? '';
    if (next === current) {
      Alert.alert('Same address', 'That is already your email on this account.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Sign in', 'Sign in to change your email.');
      return;
    }

    setSaving(true);
    try {
      const verified = await loginWithPassword(user.email, currentPassword);
      if (!verified.ok) {
        Alert.alert('Could not verify', verified.message || 'Check your current password.');
        return;
      }
      const out = await saveEmail(next);
      if (out.ok) {
        setNewEmail('');
        setCurrentPassword('');
        Alert.alert('Email updated', 'Your sign-in email has been changed.');
      } else {
        Alert.alert('Could not update', out.message || 'Try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [newEmail, currentPassword, user?.id, user?.email, saveEmail]);

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <Field label="Current email">
            <Text style={s.readOnlyValue}>{user?.email?.trim() || '—'}</Text>
          </Field>
          <View style={s.divider} />
          <Field label="New email">
            <TextInput
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="you@example.com"
              placeholderTextColor={MUTED}
              style={s.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
          <View style={s.divider} />
          <Field label="Current password">
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter password"
              placeholderTextColor={MUTED}
              style={s.inputSecure}
              secureTextEntry
            />
          </Field>
        </View>

        <Pressable
          style={({ pressed }) => [s.saveBtn, pressed && s.saveBtnPressed, saving && { opacity: 0.65 }]}
          onPress={() => {
            onSave().catch(() => {});
          }}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={s.saveBtnText}>Update email</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}
