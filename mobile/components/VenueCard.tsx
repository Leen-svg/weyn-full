import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Card } from './Card';
import { border, colors, fonts, radius, type, androidTextFix } from '@/theme';
import type { Venue } from '@/lib/types';

export function VenueCard({ venue, rank }: { venue: Venue; rank?: number }) {
  const meta = [venue.neighborhood, venue.city].filter(Boolean).join(' · ');
  const spend = venue.avg_spend_aed ? `≈ ${venue.avg_spend_aed} AED` : null;
  const tags = (venue.tags ?? []).slice(0, 4);

  return (
    <Card compact style={styles.card}>
      {venue.cover_url ? (
        <Image
          source={{ uri: venue.cover_url }}
          style={styles.cover}
          contentFit="cover"
          transition={180}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={styles.headingRow}>
        {rank !== undefined ? (
          <View style={styles.rank}>
            <Text style={[styles.rankText, androidTextFix]}>{rank}</Text>
          </View>
        ) : null}
        <Text style={[styles.name, androidTextFix]} numberOfLines={2}>
          {venue.name}
        </Text>
      </View>

      {meta || spend ? (
        <Text style={[styles.meta, androidTextFix]}>
          {[meta, spend].filter(Boolean).join('  ·  ')}
        </Text>
      ) : null}

      {tags.length ? (
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <View key={tag.display_name} style={styles.tagPill}>
              <Text style={[styles.tagText, androidTextFix]}>{tag.display_name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {venue.description ? (
        <Text style={[type.small, androidTextFix, styles.description]} numberOfLines={3}>
          {venue.description}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 4 },
  cover: {
    width: '100%',
    height: 170,
    borderRadius: radius.sm,
    borderWidth: border.thin,
    borderColor: border.color,
    backgroundColor: colors.purpleWash,
    marginBottom: 14,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: border.thin,
    borderColor: border.color,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  name: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    letterSpacing: -0.6,
    color: colors.ink,
  },
  meta: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 5,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tagPill: {
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: border.color,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  description: { marginTop: 10 },
});
