import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, androidTextFix } from '@/theme';

/** Always lowercase "weyn" plus a pink ؟ rotated 12°. */
export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Weyn">
      <Text style={[styles.word, androidTextFix, { fontSize: size }]}>weyn</Text>
      <Text
        style={[
          styles.question,
          androidTextFix,
          { fontSize: size, transform: [{ rotate: '12deg' }] },
        ]}
      >
        ؟
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  word: { fontFamily: fonts.display, color: colors.blueDeep },
  question: { fontFamily: fonts.arabic, color: colors.pink },
});
