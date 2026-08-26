begin;

create table if not exists public.curator_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  curator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, curator_id),
  check (follower_id <> curator_id)
);
alter table public.curator_follows enable row level security;
drop policy if exists curator_follows_own on public.curator_follows;
create policy curator_follows_own on public.curator_follows for all to authenticated using (follower_id = auth.uid()) with check (follower_id = auth.uid());

with target_category as (
  select id from public.categories order by display_order nulls last, id limit 1
), safe_tags(slug, display_name, display_order) as (values
  ('hidden-gem', 'Hidden Gem', 901),
  ('specialty-coffee-elite', 'Specialty Coffee Elite', 902),
  ('aesthetic-focused', 'Aesthetic Focused', 903),
  ('overhyped', 'Overhyped', 904),
  ('tiktok-trap', 'TikTok Trap', 905),
  ('loud-atmosphere', 'Loud Atmosphere', 906),
  ('skip-food-get-drinks', 'Skip the Food, Get Drinks', 907),
  ('overpriced', 'Overpriced', 908)
)
insert into public.vibe_tags (category_id, slug, display_name, subgroup, subgroup_order, display_order, seasonal_exclude, is_active)
select target_category.id, safe_tags.slug, safe_tags.display_name, 'Community signals', 90, safe_tags.display_order, false, true
from safe_tags cross join target_category
on conflict (slug) do update set display_name = excluded.display_name, is_active = true, seasonal_exclude = false;

commit;

