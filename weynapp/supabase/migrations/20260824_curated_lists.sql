-- Admin-curated venue lists (e.g. "Weyn's picks", "Best rooftops") shown to
-- all users, distinct from the personal saved_lists a user builds for
-- themselves. Admins create/edit these and add venues to them from /admin;
-- everyone can read the active ones.
create table public.curated_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_image_url text,
  is_active boolean not null default true,
  position integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.curated_list_venues (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.curated_lists(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, venue_id)
);

create index curated_list_venues_list_id_idx on public.curated_list_venues(list_id);
create index curated_list_venues_venue_id_idx on public.curated_list_venues(venue_id);

alter table public.curated_lists enable row level security;
alter table public.curated_list_venues enable row level security;

create policy "anyone can read active curated lists" on public.curated_lists
  for select using (is_active = true);

create policy "admins can read all curated lists" on public.curated_lists
  for select using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins can manage curated lists" on public.curated_lists
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "anyone can read venues of active lists" on public.curated_list_venues
  for select using (exists (select 1 from public.curated_lists l where l.id = list_id and l.is_active = true));

create policy "admins can manage curated list venues" on public.curated_list_venues
  for all using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
