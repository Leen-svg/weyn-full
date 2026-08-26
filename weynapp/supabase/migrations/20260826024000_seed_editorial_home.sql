insert into public.editorial_lists (title, subtitle, slug, city, home_section, sort_order, is_published)
values
  ('Our picks · Abu Dhabi', 'Capital favourites chosen by Weyn.', 'our-picks-abu-dhabi', 'Abu Dhabi', 'our_picks', 0, true),
  ('Our picks · Dubai', 'Dubai favourites chosen by Weyn.', 'our-picks-dubai', 'Dubai', 'our_picks', 1, true),
  ('Date Night', 'Good lighting, good food, no group-chat debate.', 'date-night', 'Abu Dhabi', 'curated', 10, true),
  ('Hidden Gems', 'The places worth knowing before everyone else does.', 'hidden-gems', 'Dubai', 'curated', 20, true)
on conflict (slug) do nothing;

with desired(list_slug, venue_name, position) as (
  values
    ('our-picks-abu-dhabi', 'Cacti restaurant', 0),
    ('our-picks-abu-dhabi', 'Finz Restaurant', 1),
    ('our-picks-abu-dhabi', 'Les Dangereux', 2),
    ('our-picks-abu-dhabi', 'Yas Bay', 3),
    ('our-picks-dubai', 'Bull & Bear Steakhouse', 0),
    ('our-picks-dubai', 'Cinque', 1),
    ('our-picks-dubai', 'Kaspia', 2),
    ('our-picks-dubai', 'La Serre', 3),
    ('date-night', 'Frontyard', 0),
    ('date-night', 'Cacti restaurant', 1),
    ('date-night', 'Finz Restaurant', 2),
    ('date-night', 'Les Dangereux', 3),
    ('date-night', 'Yas Bay', 4),
    ('hidden-gems', 'Kaspia', 0),
    ('hidden-gems', 'Long Island Restaurant', 1),
    ('hidden-gems', 'MamaBella Ristorante', 2),
    ('hidden-gems', 'Not Only Fish', 3),
    ('hidden-gems', 'The Fox''s Arms', 4),
    ('hidden-gems', '1920', 5)
), resolved as (
  select list.id as list_id, venue.id as venue_id, desired.position
  from desired
  join public.editorial_lists list on list.slug = desired.list_slug
  join lateral (
    select candidate.id
    from public.venues candidate
    where candidate.name = desired.venue_name and candidate.is_active
    order by candidate.created_at desc
    limit 1
  ) venue on true
  where not exists (
    select 1 from public.editorial_list_items existing where existing.list_id = list.id
  )
)
insert into public.editorial_list_items (list_id, venue_id, position)
select list_id, venue_id, position from resolved
on conflict (list_id, venue_id) do nothing;
