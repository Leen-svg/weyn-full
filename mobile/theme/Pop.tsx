import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, ShadowSize } from './tokens';

/**
 * The hard offset shadow — `box-shadow: 6px 6px 0 var(--ink)` — is most of
 * what makes Weyn look like Weyn, so it has to be exact on both platforms.
 *
 * Neither native shadow API can produce it:
 *   - iOS shadowRadius: 0 gets close, but Android ignores those props entirely.
 *   - Android `elevation` is always a blurred, alpha'd Material shadow whose
 *     offset you cannot control. It looks nothing like a hard pop shadow.
 *
 * So we draw the shadow ourselves: a solid ink rectangle the same size as the
 * content, offset by (dx, dy), sitting behind it. Identical on both platforms,
 * no blur, no alpha, and it costs one extra View.
 *
 * The wrapper reserves dx/dy of trailing space so the shadow does not overlap
 * whatever sits below it in a column.
 */
export function Pop({
  children,
  size = 'md',
  borderRadius = radius.lg,
  color = colors.ink,
  style,
  pressed = false,
}: {
  children: ReactNode;
  size?: ShadowSize;
  borderRadius?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * The signature press interaction: the surface moves down-right into its own
   * shadow, so the shadow shrinks rather than the element fading or scaling.
   */
  pressed?: boolean;
}) {
  const { dx, dy } = shadow[size];
  const offset = pressed ? 2 : 0;

  return (
    <View style={[{ marginRight: dx, marginBottom: dy }, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: dx,
          top: dy,
          right: -dx,
          bottom: -dy,
          borderRadius,
          backgroundColor: color,
        }}
      />
      <View style={{ transform: [{ translateX: offset }, { translateY: offset }] }}>
        {children}
      </View>
    </View>
  );
}
