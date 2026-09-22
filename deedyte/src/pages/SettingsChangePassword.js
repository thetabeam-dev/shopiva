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

export default function SettingsChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const { user, savePassword } = useProfile();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = useCallback(async () => {
    if (!currentPassword) {
      Alert.alert('Missing field', 'Enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Invalid password', 'Use at least 8 characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation must match.');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Same password', 'Choose a new password that is different from your current one.');
      return;
    }
    if (!user?.id || !user?.email?.trim()) {
      Alert.alert('Sign in', 'Sign in to change your password.');
      return;
    }

    setSaving(true);
    try {
      const verified = await loginWithPassword(user.email, currentPassword);
      if (!verified.ok) {
        Alert.alert('Could not verify', verified.message || 'Check your current password.');
        return;
      }
      const out = await savePassword(newPassword);
      if (out.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert('Password updated', 'Your password has been changed. Sign in with your new password next time.');
      } else {
        Alert.alert('Could not update', out.message || 'Try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword, user?.id, user?.email, savePassword]);

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
        <Text style={s.intro}>Choose a strong password you haven’t used elsewhere.</Text>

        <View style={s.card}>
          <Field label="Current password">
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={MUTED}
              style={s.inputSecure}
              secureTextEntry
            />
          </Field>
          <View style={s.divider} />
          <Field label="New password">
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={MUTED}
              style={s.inputSecure}
              secureTextEntry
            />
          </Field>
          <View style={s.divider} />
          <Field label="Confirm new password">
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat new password"
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
            <Text style={s.saveBtnText}>Update password</Text>
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
