import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { TAB_BAR_HEIGHT } from './_layout';
import { type, androidTextFix } from '@/theme';

/**
 * Not built yet. The web route stays live and is the source of truth until
 * this screen is ported — see mobile/README.md for the porting order.
 */
export default function Plan() {
  return (
    <Screen tabBarInset={TAB_BAR_HEIGHT}>
      <View style={styles.header}>
        <Text style={[type.eyebrow, androidTextFix]}>Plan together</Text>
        <Text style={[type.h1, androidTextFix]}>Boards and votes</Text>
      </View>
      <Card tone="yellow" tilt>
        <Text style={[type.h3, androidTextFix]}>Coming to the app</Text>
        <Text style={[type.body, androidTextFix, styles.body]}>
          Boards, polls and the group vote still live on the web. This screen is next after Find.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 22, gap: 4 },
  body: { marginTop: 10 },
});
