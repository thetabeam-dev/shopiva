import { KeyboardAvoidingView, Platform } from 'react-native';

/**
 * Shared wrapper so form TextInputs stay above the keyboard.
 * iOS: padding + stack-header offset. Android: rely on windowSoftInputMode=adjustResize
 * (avoiding a second resize from KeyboardAvoidingView).
 *
 * @param {{
 *   children: React.ReactNode;
 *   style?: object | object[];
 *   offset?: number;
 * }} props
 */
export default function FormKeyboardAvoiding({ children, style, offset }) {
  const keyboardVerticalOffset =
    offset ?? (Platform.OS === 'ios' ? 88 : 0);

  return (
    <KeyboardAvoidingView
      style={style ?? { flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
