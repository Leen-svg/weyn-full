import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { border, colors, fonts, radius, androidTextFix } from '@/theme';

/**
 * The web nav is a floating rounded capsule. That translates directly to a
 * floating tab bar, so the shell reads the same on both. Icons are deliberately
 * text glyphs for now: the brand has no icon set yet, and a borrowed one
 * (Material, SF Symbols) would look imported.
 */
function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={[styles.icon, focused && styles.iconFocused]}>
      <Text style={[styles.glyph, androidTextFix]}>{glyph}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen
        name="find"
        options={{
          title: 'Find',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => <TabIcon glyph="▦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused }) => <TabIcon glyph="✦" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◍" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

export const TAB_BAR_HEIGHT = 72;

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 26 : 16,
    height: TAB_BAR_HEIGHT,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.paper,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radius.pill,
    // The web capsule uses backdrop-filter on desktop only, for the same
    // reason it is absent here: it is the most expensive thing on a phone.
    // A near-solid paper fill reads the same at this size.
    elevation: 0,
    shadowOpacity: 0,
  },
  item: { paddingVertical: 2 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11 },
  icon: {
    width: 30,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  iconFocused: { backgroundColor: colors.yellow },
  glyph: { fontSize: 15, color: colors.ink, fontFamily: fonts.displayBold },
});
