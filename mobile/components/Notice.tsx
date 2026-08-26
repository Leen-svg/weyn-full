import { StyleSheet, Text, View } from 'react-native';
import { border, colors, fonts, androidTextFix } from '@/theme';

export function Notice({ children, tone = 'info' }: { children: string; tone?: 'info' | 'error' }) {
  return (
    <View style={[styles.notice, tone === 'error' && styles.error]}>
      <Text style={[styles.text, androidTextFix]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.yellowWash,
    borderWidth: border.thin,
    borderColor: border.color,
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  error: { backgroundColor: colors.pinkWash },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
});
