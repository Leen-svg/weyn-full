import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Accordion } from '@/components/Accordion';
import { VenueCard } from '@/components/VenueCard';
import { TAB_BAR_HEIGHT } from './_layout';
import { useTaxonomy } from '@/lib/useTaxonomy';
import { api } from '@/lib/api';
import { colors, fonts, type, androidTextFix } from '@/theme';
import type { ShortlistRequest, ShortlistResponse } from '@/lib/types';

const CITIES: ShortlistRequest['city'][] = ['Abu Dhabi', 'Dubai'];

// Mirrors the web budget steps. 99999 is what the route treats as "no cap".
const BUDGETS: { label: string; value: number }[] = [
  { label: 'Any', value: 99999 },
  { label: 'Under 150', value: 150 },
  { label: 'Under 300', value: 300 },
  { label: 'Under 600', value: 600 },
];

const AGES: { label: string; value: ShortlistRequest['maxAge'] }[] = [
  { label: 'All ages', value: 'all-ages' },
  { label: '18+', value: '18-plus' },
  { label: '21+', value: '21-plus' },
];

export default function Find() {
  const { groups, zones, loading: taxonomyLoading, error: taxonomyError, reload } = useTaxonomy();

  const [city, setCity] = useState<ShortlistRequest['city']>('Abu Dhabi');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set());
  const [budget, setBudget] = useState(99999);
  const [maxAge, setMaxAge] = useState<ShortlistRequest['maxAge']>('all-ages');
  const [aesthetic, setAesthetic] = useState(false);
  const [nearby, setNearby] = useState<ShortlistRequest['nearby']>(null);
  const [locationBusy, setLocationBusy] = useState(false);

  const [results, setResults] = useState<ShortlistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tags = useMemo(() => Array.from(selected), [selected]);

  function toggle(set: Set<string>, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  async function useMyLocation() {
    if (nearby) {
      setNearby(null);
      return;
    }
    setLocationBusy(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location is off for Weyn. Turn it on in Settings to use Near me.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setNearby({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        radiusKm: 15,
      });
    } catch {
      setError('Could not get your location.');
    } finally {
      setLocationBusy(false);
    }
  }

  async function search() {
    setError(null);
    setBusy(true);
    setResults(null);
    try {
      const body: ShortlistRequest = {
        tags,
        maxSpend: budget,
        aestheticOnly: aesthetic,
        zones: Array.from(selectedZones),
        maxAge,
        city,
        nearby,
      };
      const data = await api<ShortlistResponse>('/api/shortlist', { method: 'POST', body });
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build a shortlist.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tabBarInset={TAB_BAR_HEIGHT}>
      <View style={styles.header}>
        <Text style={[type.eyebrow, androidTextFix]}>Find your next spot</Text>
        <Text style={[type.h1, androidTextFix]}>We&apos;re feeling…</Text>
        <Text style={[type.lead, androidTextFix, styles.sub]}>
          Tap what fits. Three spots, then the group votes.
        </Text>
      </View>

      <Row label="City">
        {CITIES.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={city === option}
            onPress={() => setCity(option)}
          />
        ))}
      </Row>

      {taxonomyError ? (
        <View>
          <Notice tone="error">{taxonomyError}</Notice>
          <Button label="Try again" size="sm" onPress={reload} />
        </View>
      ) : null}

      {taxonomyLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.purple} />
        </View>
      ) : (
        <View style={styles.groups}>
          {groups.map((group, index) => {
            const count = group.tags.filter((tag) => selected.has(tag.slug)).length;
            return (
              <Accordion
                key={group.id}
                title={group.name}
                meta={count ? `${count} picked` : undefined}
                defaultOpen={index === 0}
              >
                <View style={styles.chips}>
                  {group.tags.map((tag) => (
                    <Chip
                      key={tag.slug}
                      label={tag.display_name}
                      selected={selected.has(tag.slug)}
                      onPress={() => setSelected((s) => toggle(s, tag.slug))}
                    />
                  ))}
                </View>
              </Accordion>
            );
          })}
        </View>
      )}

      {zones.length ? (
        <Row label="Area">
          {zones
            .filter((zone) => !zone.emirate || zone.emirate === city)
            .map((zone) => (
              <Chip
                key={zone.slug}
                label={zone.name}
                selected={selectedZones.has(zone.slug)}
                onPress={() => setSelectedZones((s) => toggle(s, zone.slug))}
              />
            ))}
        </Row>
      ) : null}

      <Row label="Budget">
        {BUDGETS.map((option) => (
          <Chip
            key={option.label}
            label={option.label}
            selected={budget === option.value}
            onPress={() => setBudget(option.value)}
          />
        ))}
      </Row>

      <Row label="Age">
        {AGES.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={maxAge === option.value}
            onPress={() => setMaxAge(option.value)}
          />
        ))}
      </Row>

      <View style={styles.toggleRow}>
        <Text style={[styles.toggleLabel, androidTextFix]}>Aesthetic spots only</Text>
        <Switch
          value={aesthetic}
          onValueChange={setAesthetic}
          trackColor={{ false: colors.paper, true: colors.purple }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.paper}
        />
      </View>

      <Button
        label={nearby ? 'Near me · on' : 'Near me'}
        variant={nearby ? 'primary' : 'ghost'}
        size="sm"
        loading={locationBusy}
        onPress={useMyLocation}
        style={styles.nearby}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <Button
        label={tags.length ? `Find ${city} spots` : 'Pick at least one tag'}
        variant="primary"
        block
        loading={busy}
        disabled={tags.length === 0}
        onPress={search}
        style={styles.submit}
      />

      {results ? (
        <View style={styles.results}>
          {results.note ? <Notice>{results.note}</Notice> : null}
          {results.venues.length === 0 ? (
            <Card tone="pink" compact>
              <Text style={[type.h3, androidTextFix]}>Nothing matched</Text>
              <Text style={[type.small, androidTextFix, styles.emptyBody]}>
                Try fewer tags, a wider budget, or turn Near me off.
              </Text>
            </Card>
          ) : (
            results.venues.map((venue, index) => (
              <VenueCard key={venue.id} venue={venue} rank={index + 1} />
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, androidTextFix]}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 22, gap: 4 },
  sub: { marginTop: 6 },
  loading: { paddingVertical: 32 },
  groups: { marginBottom: 8 },
  row: { marginBottom: 18 },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.ink,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  toggleLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  nearby: { marginBottom: 18 },
  submit: { marginTop: 4 },
  results: { marginTop: 28, gap: 4 },
  emptyBody: { marginTop: 8 },
});
