import { StyleSheet, Text, Pressable } from 'react-native';
import { border, colors, radius, type, androidTextFix } from '@/theme';

/**
 * The selected chip on the web lifts and gains a 3px shadow. Here the lift is
 * kept and the shadow is dropped: a Pop wrapper around every chip in a wrapped
 * row would add two Views per tag across a taxonomy of a few hundred, and the
 * yellow fill already carries the selected state.
 */
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[type.chip, androidTextFix]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.paper,
    borderWidth: border.thin,
    borderColor: border.color,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  selected: {
    backgroundColor: colors.yellow,
    transform: [{ translateY: -2 }],
  },
  pressed: { backgroundColor: colors.skyWash },
});
