begin;

alter table public.profile_public add column if not exists ghost_mode boolean not null default true;
alter table public.profile_public add column if not exists is_curator boolean not null default false;

alter table public.venues add column if not exists parking_type text;
alter table public.venues add column if not exists has_indoor_ac boolean not null default false;
alter table public.venues add column if not exists has_covered_terrace boolean not null default false;
alter table public.venues add column if not exists has_underground_parking boolean not null default false;
alter table public.venues add column if not exists has_outdoor_seating boolean not null default false;
alter table public.venues add column if not exists open_late boolean not null default false;
alter table public.venues add column if not exists has_shisha boolean not null default false;
alter table public.venues add column if not exists has_prayer_room boolean not null default false;
alter table public.venues add column if not exists opening_hours jsonb not null default '{}'::jsonb;

alter table public.reviews add column if not exists aesthetic_taste integer;
alter table public.reviews add column if not exists quiet_loud integer;
alter table public.reviews add column if not exists wallet_splurge integer;
do $$ begin alter table public.reviews add constraint review_aesthetic_taste check (aesthetic_taste between 0 and 100); exception when duplicate_object then null; end $$;
do $$ begin alter table public.reviews add constraint review_quiet_loud check (quiet_loud between 0 and 100); exception when duplicate_object then null; end $$;
do $$ begin alter table public.reviews add constraint review_wallet_splurge check (wallet_splurge between 0 and 100); exception when duplicate_object then null; end $$;

create table if not exists public.personal_places (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, neighborhood text, city text, latitude double precision, longitude double precision,
  source_url text, created_at timestamptz not null default now(), unique(user_id, name, city)
);
alter table public.personal_places enable row level security;
drop policy if exists personal_places_own on public.personal_places;
create policy personal_places_own on public.personal_places for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table if not exists public.trip_boards (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null, share_slug text not null unique default encode(gen_random_bytes(9),'hex'),
  is_public boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.trip_board_members (
  board_id uuid references public.trip_boards(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','member')), primary key(board_id,user_id)
);
create table if not exists public.trip_board_places (
  id uuid primary key default gen_random_uuid(), board_id uuid not null references public.trip_boards(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete cascade, personal_place_id uuid references public.personal_places(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade, position integer not null default 0,
  created_at timestamptz not null default now(), check ((venue_id is null) <> (personal_place_id is null))
);
create table if not exists public.trip_board_votes (
  board_place_id uuid references public.trip_board_places(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
  vote smallint not null check(vote in (-1,1)), primary key(board_place_id,user_id)
);
alter table public.trip_boards enable row level security;
alter table public.trip_board_members enable row level security;
alter table public.trip_board_places enable row level security;
alter table public.trip_board_votes enable row level security;
create or replace function public.can_access_trip_board(p_board_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.trip_boards b where b.id=p_board_id and (b.is_public or b.owner_id=auth.uid() or exists(select 1 from public.trip_board_members m where m.board_id=b.id and m.user_id=auth.uid()))) $$;
create or replace function public.can_edit_trip_board(p_board_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.trip_boards b where b.id=p_board_id and (b.owner_id=auth.uid() or exists(select 1 from public.trip_board_members m where m.board_id=b.id and m.user_id=auth.uid()))) $$;
revoke all on function public.can_access_trip_board(uuid) from public; grant execute on function public.can_access_trip_board(uuid) to anon, authenticated;
revoke all on function public.can_edit_trip_board(uuid) from public; grant execute on function public.can_edit_trip_board(uuid) to authenticated;
drop policy if exists boards_read on public.trip_boards;
create policy boards_read on public.trip_boards for select using (public.can_access_trip_board(id));
drop policy if exists boards_owner on public.trip_boards;
create policy boards_owner on public.trip_boards for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists board_members_read on public.trip_board_members;
create policy board_members_read on public.trip_board_members for select using(public.can_access_trip_board(board_id));
drop policy if exists board_places_read on public.trip_board_places;
create policy board_places_read on public.trip_board_places for select using(public.can_access_trip_board(board_id));
drop policy if exists board_places_write on public.trip_board_places;
create policy board_places_write on public.trip_board_places for all to authenticated using(public.can_edit_trip_board(board_id)) with check(public.can_edit_trip_board(board_id) and added_by=auth.uid());
drop policy if exists board_votes_own on public.trip_board_votes;
create policy board_votes_own on public.trip_board_votes for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.trip_board_places p where p.id=board_place_id and public.can_edit_trip_board(p.board_id)));

create or replace function public.add_board_owner() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.trip_board_members(board_id,user_id,role) values(new.id,new.owner_id,'owner') on conflict do nothing; return new; end $$;
drop trigger if exists trip_board_owner_trigger on public.trip_boards;
create trigger trip_board_owner_trigger after insert on public.trip_boards for each row execute function public.add_board_owner();
commit;
