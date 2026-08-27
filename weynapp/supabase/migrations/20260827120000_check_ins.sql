begin;

-- Confirming you actually went somewhere. One row per user per venue per day:
-- the reward is for visiting, not for tapping the button repeatedly, and a
-- genuine second visit on another day should still count.
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  visited_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  unique (user_id, venue_id, visited_on)
);

create index if not exists check_ins_user_created_idx
  on public.check_ins (user_id, created_at desc);
create index if not exists check_ins_venue_idx
  on public.check_ins (venue_id);

alter table public.check_ins enable row level security;

-- A check-in is private to the person who made it. Aggregate counts are read
-- through the service role, never by reading other people's rows.
drop policy if exists check_ins_own on public.check_ins;
create policy check_ins_own on public.check_ins
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
