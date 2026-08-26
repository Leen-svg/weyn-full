import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { TagGroup, Zone } from './types';

/**
 * GET /api/taxonomy currently returns `{ groups }` only — the web /find page
 * reads zones through getTaxonomy() server-side, so they never had to travel
 * over the wire. Zones are read here when the route starts sending them
 * (a one-line change on the web) and the zone filter stays hidden until then.
 */
type TaxonomyResponse = { groups: TagGroup[]; zones?: Zone[] };

export function useTaxonomy() {
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<TaxonomyResponse>('/api/taxonomy', { anonymous: true });
      setGroups(data.groups ?? []);
      setZones(data.zones ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the tag list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { groups, zones, loading, error, reload: load };
}
