-- Affiliate ticket inventory (Platinumlist and any later partner).
--
-- Deliberately a separate table rather than a `venues` row with a URL on it.
-- The roadmap's rule is "no revenue placement masquerading as an organic
-- recommendation" — keeping paid inventory in its own table means it *cannot*
-- reach the three-pick shortlist, Discover, or Find, because none of those
-- queries touch this table. That is a structural guarantee rather than a
-- filter someone has to remember to write.
--
-- Every render must carry a visible partner label and rel="sponsored".

create table if not exists public.attractions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  city text not null default 'Dubai',
  neighborhood text,
  category text not null default 'other'
    check (category in ('theme-park','waterpark','desert-safari','landmark','cruise','tour','show','museum','adventure','other')),
  cover_image_url text,
  affiliate_url text not null,
  partner text not null default 'platinumlist',
  price_from_aed integer,
  age_restriction text not null default 'all-ages'
    check (age_restriction in ('all-ages','18-plus','21-plus')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.attractions is
  'Affiliate ticket inventory (Platinumlist et al). Deliberately NOT venues: paid placements must never be able to surface inside organic recommendations or three-pick results. Every render must carry a partner label.';
comment on column public.attractions.affiliate_url is
  'Partner deep link. Commercial: render with rel="sponsored nofollow noopener noreferrer" and a visible label.';

create index if not exists attractions_live_idx
  on public.attractions (is_active, age_restriction, sort_order);

alter table public.attractions enable row level security;

drop policy if exists attractions_public_read on public.attractions;
create policy attractions_public_read on public.attractions
  for select using (is_active);

create or replace function public.attractions_touch_updated_at()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists attractions_touch_updated_at on public.attractions;
create trigger attractions_touch_updated_at
  before update on public.attractions
  for each row execute function public.attractions_touch_updated_at();
