import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

/**
 * Every screen sits on paper, respects the notch and the home indicator, and
 * leaves room for the floating tab bar. The web's fixed dot-grid background is
 * deliberately not ported — it was already desktop-only for exactly the repaint
 * cost that matters more here.
 */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  /** Extra bottom padding when the floating tab bar overlaps the content. */
  tabBarInset = 0,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  tabBarInset?: number;
}) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + 12,
    paddingBottom: insets.bottom + 24 + tabBarInset,
  };

  if (!scroll) {
    return <View style={[styles.screen, styles.body, padding, contentStyle]}>{children}</View>;
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.body, padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: 20 },
});
