import { useCallback, useEffect, useState } from 'react';
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
import { useProfile } from '../context/ProfileContext';
import { MUTED, settingsFormStyles as s } from './settingsFields';

export default function SettingsWhatsappScreen() {
  const insets = useSafeAreaInsets();
  const { user, savePhone } = useProfile();
  const [whatsapp, setWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.phone != null) {
      setWhatsapp(user.phone);
    }
  }, [user?.id, user?.phone]);

  const onSave = useCallback(async () => {
    const trimmed = whatsapp.trim();
    if (!trimmed) {
      Alert.alert('Missing number', 'Enter your WhatsApp number.');
      return;
    }
    setSaving(true);
    try {
      const out = await savePhone(trimmed);
      if (out.ok) {
        Alert.alert('Saved', 'Your WhatsApp number has been updated.');
      } else {
        Alert.alert('Could not save', out.message || 'Try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [whatsapp, savePhone]);

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
        <Text style={s.intro}>
          Include country code (e.g. +44…). Used for order updates and support if you opt in.
        </Text>

        <View style={s.card}>
          <Field label="WhatsApp number">
            <TextInput
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="+1 555 000 0000"
              placeholderTextColor={MUTED}
              style={s.input}
              keyboardType="phone-pad"
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
            <Text style={s.saveBtnText}>Save WhatsApp number</Text>
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
