-- Dated inventory (parties, club nights, ladies' nights, live music, brunches).
--
-- Venues answer "where is good"; events answer "what is on". The 21+ section
-- needs both, and the strategy docs are explicit that a stale event graph is
-- lethal — so expiry is enforced in the RLS policy, not left to a filter that
-- someone will eventually forget to write.
--
-- venue_id is nullable on purpose: a pop-up or a party at an uncatalogued
-- address is still a real event.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues(id) on delete set null,
  title text not null,
  description text,
  city text not null default 'Dubai',
  neighborhood text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  age_restriction text not null default 'all-ages'
    check (age_restriction in ('all-ages','18-plus','21-plus')),
  event_type text not null default 'party'
    check (event_type in ('party','club-night','live-music','brunch','ladies-night','other')),
  cover_image_url text,
  ticket_url text,
  price_from_aed integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_ends_after_start check (ends_at is null or ends_at >= starts_at)
);

comment on table public.events is
  'Dated nightlife/occasion inventory. Events expire: never surface one whose window has passed. A stale event graph is worse than an empty one.';

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_live_idx on public.events (is_active, age_restriction, starts_at);
create index if not exists events_venue_idx on public.events (venue_id);

alter table public.events enable row level security;

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select
  using (
    is_active
    and coalesce(ends_at, starts_at + interval '6 hours') > now()
  );

-- Writes are service-role only (admin routes), matching how venues are managed.

create or replace function public.events_touch_updated_at()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.events_touch_updated_at();
