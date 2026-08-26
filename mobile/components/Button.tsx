import { ReactNode, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle, ActivityIndicator } from 'react-native';
import { Pop, border, colors, radius, type, androidTextFix } from '@/theme';

type Variant = 'primary' | 'default' | 'ghost' | 'dark';
type Size = 'md' | 'sm';

const surface: Record<Variant, { background: string; label: string }> = {
  primary: { background: colors.purple, label: colors.white }, // the one action that matters
  default: { background: colors.yellow, label: colors.ink },
  ghost: { background: colors.white, label: colors.ink },
  dark: { background: colors.inkDeep, label: colors.paper },
};

export function Button({
  label,
  onPress,
  variant = 'default',
  size = 'md',
  block = false,
  disabled = false,
  loading = false,
  left,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  left?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [pressed, setPressed] = useState(false);
  const { background, label: labelColor } = surface[variant];
  const inert = disabled || loading;

  return (
    <Pop
      size={size === 'sm' ? 'xs' : 'sm'}
      borderRadius={radius.pill}
      pressed={pressed && !inert}
      style={[block ? styles.block : styles.inline, style]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: inert, busy: loading }}
        disabled={inert}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[
          styles.base,
          size === 'sm' ? styles.sm : styles.md,
          { backgroundColor: background },
          inert && styles.inert,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={labelColor} />
        ) : (
          <View style={styles.row}>
            {left}
            <Text
              numberOfLines={1}
              style={[
                type.button,
                androidTextFix,
                { color: labelColor },
                size === 'sm' && styles.smText,
              ]}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Pop>
  );
}

const styles = StyleSheet.create({
  inline: { alignSelf: 'flex-start' },
  block: { alignSelf: 'stretch' },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radius.pill,
  },
  md: { paddingVertical: 12, paddingHorizontal: 22 },
  sm: { paddingVertical: 8, paddingHorizontal: 15 },
  smText: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inert: { opacity: 0.45 },
});
