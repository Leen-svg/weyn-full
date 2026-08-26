import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Pop, border, colors, radius, ShadowSize } from '@/theme';

type Tone = 'white' | 'sky' | 'yellow' | 'purple' | 'pink' | 'dark';

/** Wash colours only, never full saturation — same rule as the web cards. */
const tones: Record<Tone, string> = {
  white: colors.white,
  sky: colors.skyWash,
  yellow: colors.yellowWash,
  purple: colors.purpleWash,
  pink: colors.pinkWash,
  dark: colors.inkDeep,
};

export function Card({
  children,
  tone = 'white',
  compact = false,
  shadow = 'md',
  tilt = false,
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  compact?: boolean;
  shadow?: ShadowSize;
  /** Use sparingly — one or two per screen, same as the web. */
  tilt?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pop
      size={shadow}
      borderRadius={compact ? radius.md : radius.lg}
      style={[tilt ? styles.tilt : null, style]}
    >
      <View
        style={[
          styles.card,
          compact ? styles.compact : styles.roomy,
          { backgroundColor: tones[tone] },
        ]}
      >
        {children}
      </View>
    </Pop>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: border.width,
    borderColor: border.color,
  },
  roomy: { borderRadius: radius.lg, padding: 24 },
  compact: { borderRadius: radius.md, padding: 18 },
  tilt: { transform: [{ rotate: '-0.6deg' }] },
});
