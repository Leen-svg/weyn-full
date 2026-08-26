create or replace function public.get_shortlist_nearby(
  p_tag_slugs text[],
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 15,
  p_max_spend integer default 99999,
  p_aesthetic_only boolean default false,
  p_limit integer default 3,
  p_exclude_ids uuid[] default '{}',
  p_max_age text default 'all-ages',
  p_random boolean default false,
  p_zone_slugs text[] default null,
  p_city text default 'Abu Dhabi'
)
returns table(
  id uuid,
  name text,
  neighborhood text,
  google_maps_url text,
  hero_video_url text,
  avg_spend_aed integer,
  price_band text,
  age_restriction text,
  category text,
  is_aesthetic boolean,
  description text,
  match_score bigint,
  distance_km double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  with allowed as (
    select case p_max_age
      when '21-plus' then array['all-ages', '18-plus', '21-plus']
      when '18-plus' then array['all-ages', '18-plus']
      else array['all-ages']
    end as ages
  ),
  candidates as (
    select
      v.id,
      v.name,
      v.neighborhood,
      v.google_maps_url,
      v.hero_video_url,
      v.avg_spend_aed,
      v.price_band,
      v.age_restriction,
      v.category,
      v.is_aesthetic,
      v.description,
      6371 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(p_lat)) * cos(radians(v.latitude)) *
          cos(radians(v.longitude) - radians(p_lng)) +
          sin(radians(p_lat)) * sin(radians(v.latitude))
        ))
      ) as distance_km
    from public.venues v
    cross join allowed a
    where v.is_active
      and v.latitude is not null
      and v.longitude is not null
      and v.city = p_city
      and v.avg_spend_aed <= p_max_spend
      and (not p_aesthetic_only or v.is_aesthetic)
      and v.age_restriction = any(a.ages)
      and (p_zone_slugs is null or array_length(p_zone_slugs, 1) is null or v.zone_slug = any(p_zone_slugs))
      and not (v.id = any(coalesce(p_exclude_ids, '{}')))
  )
  select
    c.id,
    c.name,
    c.neighborhood,
    c.google_maps_url,
    c.hero_video_url,
    c.avg_spend_aed,
    c.price_band,
    c.age_restriction,
    c.category,
    c.is_aesthetic,
    c.description,
    matches.match_score,
    c.distance_km
  from candidates c
  cross join lateral (
    select count(*)::bigint as match_score
    from public.venue_tags vt
    join public.vibe_tags tag on tag.id = vt.tag_id
    where vt.venue_id = c.id
      and tag.slug = any(p_tag_slugs)
  ) matches
  where c.distance_km <= greatest(1, least(50, p_radius_km))
    and (p_random or matches.match_score > 0)
  order by
    case when p_random then 0 else matches.match_score end desc,
    c.distance_km asc,
    random()
  limit greatest(1, least(25, p_limit));
$$;

revoke all on function public.get_shortlist_nearby(text[], double precision, double precision, double precision, integer, boolean, integer, uuid[], text, boolean, text[], text) from public;
grant execute on function public.get_shortlist_nearby(text[], double precision, double precision, double precision, integer, boolean, integer, uuid[], text, boolean, text[], text) to service_role;
