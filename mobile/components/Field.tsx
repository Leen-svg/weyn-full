import { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { border, colors, fonts, radius, androidTextFix } from '@/theme';

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, androidTextFix]}>{label}</Text>
      {hint ? <Text style={[styles.hint, androidTextFix]}>{hint}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkSoft}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, androidTextFix, focused && styles.focused]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 18 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 7,
  },
  hint: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.inkSoft,
    marginBottom: 7,
  },
  input: {
    borderWidth: border.thin,
    borderColor: border.color,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontSize: 15,
    fontFamily: fonts.bodySemi,
    color: colors.ink,
  },
  // The web uses `box-shadow` on :focus. There is no focus pseudo-class in
  // React Native, so focus is tracked in state and drawn as a purple ring.
  focused: {
    borderColor: colors.purple,
    backgroundColor: colors.purpleWash,
  },
});
