import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { TAB_BAR_HEIGHT } from './_layout';
import { useAuth } from '@/lib/auth';
import { colors, fonts, type, androidTextFix } from '@/theme';

/**
 * Points, saves, friends and account settings are still web-only. Sign out is
 * here because the auth flow is not testable end to end without it.
 */
export default function Profile() {
  const { session, signOut } = useAuth();

  return (
    <Screen tabBarInset={TAB_BAR_HEIGHT}>
      <View style={styles.header}>
        <Text style={[type.eyebrow, androidTextFix]}>You</Text>
        <Text style={[type.h1, androidTextFix]}>Your Weyn</Text>
      </View>

      <Card compact>
        <Text style={[styles.label, androidTextFix]}>Signed in as</Text>
        <Text style={[type.h3, androidTextFix]} numberOfLines={1}>
          {session?.user.email ?? 'Unknown'}
        </Text>
      </Card>

      <Card tone="yellow" tilt style={styles.card}>
        <Text style={[type.h3, androidTextFix]}>Coming to the app</Text>
        <Text style={[type.body, androidTextFix, styles.body]}>
          Points, saves, friends and account settings. All of it still works on
          the web in the meantime.
        </Text>
      </Card>

      <Button label="Sign out" variant="ghost" block style={styles.card} onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 22, gap: 4 },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 6,
  },
  card: { marginTop: 16 },
  body: { marginTop: 10 },
});
