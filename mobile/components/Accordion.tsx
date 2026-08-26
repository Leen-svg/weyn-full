import { ReactNode, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { border, colors, fonts, androidTextFix } from '@/theme';

// Old-architecture Android needs this opt-in for LayoutAnimation. It is a
// no-op (and harmless) on the new architecture, where the animation is native.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function Accordion({
  title,
  meta,
  children,
  defaultOpen = false,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <Text style={[styles.title, androidTextFix]}>{title}</Text>
        <View style={styles.headerRight}>
          {meta ? <Text style={[styles.meta, androidTextFix]}>{meta}</Text> : null}
          <Text style={[styles.chevron, androidTextFix, open && styles.chevronOpen]}>›</Text>
        </View>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: border.thin,
    borderColor: border.color,
    borderRadius: 14,
    backgroundColor: colors.white,
    marginBottom: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 54,
    gap: 12,
  },
  headerPressed: { backgroundColor: colors.paper },
  title: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 15,
    color: colors.ink,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
  chevron: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: colors.ink,
    // Rotation is instant rather than transitioned: LayoutAnimation above
    // already carries the motion, and a second easing curve reads as lag.
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 12,
    borderTopWidth: border.thin,
    borderTopColor: border.color,
    backgroundColor: 'rgba(249,249,249,0.72)',
  },
});
