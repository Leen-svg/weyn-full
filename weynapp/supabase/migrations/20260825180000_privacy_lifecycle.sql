begin;

do $$ begin
  create type public.content_visibility as enum ('private', 'friends', 'public');
exception when duplicate_object then null; end $$;

create or replace function public.is_accepted_friend(p_owner_id uuid, p_viewer_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p_viewer_id is not null and exists(
    select 1 from public.friendships f
    where f.status='accepted' and (
      (f.requester_id=p_owner_id and f.addressee_id=p_viewer_id) or
      (f.addressee_id=p_owner_id and f.requester_id=p_viewer_id)
    )
  )
$$;
revoke all on function public.is_accepted_friend(uuid,uuid) from public;
grant execute on function public.is_accepted_friend(uuid,uuid) to anon,authenticated;

-- PostgreSQL will not change a column type while an RLS policy depends on it.
-- Remove the current post policies inside this transaction and recreate their
-- stricter equivalents below after the enum conversion.
drop policy if exists posts_select_visible on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_update_own on public.posts;
drop policy if exists posts_delete_own on public.posts;

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts alter column visibility drop default;
alter table public.posts alter column visibility type public.content_visibility
  using (case when visibility::text in ('private','friends','public') then visibility::text else 'private' end)::public.content_visibility;
alter table public.posts alter column visibility set default 'private'::public.content_visibility;
alter table public.posts add column if not exists archived_at timestamptz;

alter table public.reviews add column if not exists visibility public.content_visibility not null default 'private';
alter table public.reviews add column if not exists archived_at timestamptz;

alter table public.saved_lists drop constraint if exists saved_lists_visibility_check;
alter table public.saved_lists alter column visibility drop default;
alter table public.saved_lists alter column visibility type public.content_visibility
  using (case when visibility::text in ('private','friends','public') then visibility::text else 'private' end)::public.content_visibility;
alter table public.saved_lists alter column visibility set default 'private'::public.content_visibility;
alter table public.saved_lists add column if not exists archived_at timestamptz;

alter table public.trip_boards add column if not exists visibility public.content_visibility not null default 'private';
alter table public.trip_boards add column if not exists archived_at timestamptz;
update public.trip_boards set visibility=case when is_public then 'public'::public.content_visibility else 'private'::public.content_visibility end;

alter table public.friend_groups add column if not exists visibility public.content_visibility not null default 'private';
alter table public.friend_groups add column if not exists archived_at timestamptz;
alter table public.friend_group_members add column if not exists archived_at timestamptz;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('venue-media','venue-media',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.group_messages add column if not exists share_type text;
alter table public.group_messages add column if not exists share_id uuid;
do $$ begin
  alter table public.group_messages add constraint group_messages_share_type_check
    check (share_type is null or share_type in ('venue','saved_list','trip_board'));
exception when duplicate_object then null; end $$;
create index if not exists group_messages_share_idx on public.group_messages(share_type,share_id) where share_id is not null;

create table if not exists public.community_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_type text not null check(context_type in ('post','review')),
  context_id uuid,
  venue_id uuid references public.venues(id) on delete set null,
  storage_path text not null unique,
  public_path text,
  mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check(byte_size > 0 and byte_size <= 5242880),
  visibility public.content_visibility not null default 'private',
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create unique index if not exists community_media_context_idx on public.community_media(context_type,context_id) where context_id is not null;
create index if not exists community_media_queue_idx on public.community_media(status,created_at);
alter table public.community_media enable row level security;
drop policy if exists community_media_owner_read on public.community_media;
create policy community_media_owner_read on public.community_media for select to authenticated using(user_id=auth.uid());
drop policy if exists community_media_owner_delete on public.community_media;
create policy community_media_owner_delete on public.community_media for delete to authenticated using(user_id=auth.uid());
grant select,delete on public.community_media to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('community-media-quarantine','community-media-quarantine',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.user_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 40),
  description text not null default '',
  visibility public.content_visibility not null default 'private',
  share_slug text not null unique default encode(gen_random_bytes(9),'hex'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);
create table if not exists public.user_tag_venues (
  tag_id uuid not null references public.user_tags(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key(tag_id,venue_id)
);
create table if not exists public.saved_list_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references public.saved_lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,list_id)
);
create table if not exists public.user_tag_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_id uuid not null references public.user_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,tag_id)
);

alter table public.user_tags enable row level security;
alter table public.user_tag_venues enable row level security;
alter table public.saved_list_bookmarks enable row level security;
alter table public.user_tag_bookmarks enable row level security;
drop policy if exists user_tags_owner on public.user_tags;
create policy user_tags_owner on public.user_tags for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists user_tags_visible on public.user_tags;
create policy user_tags_visible on public.user_tags for select using(
  archived_at is null and (visibility='public' or (visibility='friends' and public.is_accepted_friend(user_id)))
);
drop policy if exists user_tag_venues_owner on public.user_tag_venues;
create policy user_tag_venues_owner on public.user_tag_venues for all to authenticated
  using(exists(select 1 from public.user_tags t where t.id=tag_id and t.user_id=auth.uid()))
  with check(exists(select 1 from public.user_tags t where t.id=tag_id and t.user_id=auth.uid()));
drop policy if exists user_tag_venues_visible on public.user_tag_venues;
create policy user_tag_venues_visible on public.user_tag_venues for select using(
  exists(select 1 from public.user_tags t where t.id=tag_id and t.archived_at is null and
    (t.visibility='public' or (t.visibility='friends' and public.is_accepted_friend(t.user_id))))
);
drop policy if exists saved_list_bookmarks_own on public.saved_list_bookmarks;
create policy saved_list_bookmarks_own on public.saved_list_bookmarks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists user_tag_bookmarks_own on public.user_tag_bookmarks;
create policy user_tag_bookmarks_own on public.user_tag_bookmarks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.user_tags,public.user_tag_venues,public.saved_list_bookmarks,public.user_tag_bookmarks to authenticated;
grant select on public.user_tags,public.user_tag_venues to anon;

drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts for select using(
  auth.uid()=user_id or (archived_at is null and status='published' and
    (visibility='public' or (visibility='friends' and public.is_accepted_friend(user_id))))
);
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert to authenticated with check(
  auth.uid()=user_id and status='published' and photo_url is null and
  not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_banned)
);
drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own on public.posts for delete to authenticated using(auth.uid()=user_id);

drop policy if exists reviews_select_visible on public.reviews;
create policy reviews_select_visible on public.reviews for select using(
  auth.uid()=user_id or (archived_at is null and status='published' and
    (visibility='public' or (visibility='friends' and public.is_accepted_friend(user_id))))
);
drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews for insert to authenticated with check(
  auth.uid()=user_id and status='published' and photo_url is null and
  not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_banned)
);
drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews for update to authenticated using(auth.uid()=user_id)
  with check(auth.uid()=user_id and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_banned));
drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own on public.reviews for delete to authenticated using(auth.uid()=user_id);

drop policy if exists saved_lists_visible on public.saved_lists;
create policy saved_lists_visible on public.saved_lists for select using(
  archived_at is null and (visibility='public' or (visibility='friends' and public.is_accepted_friend(user_id)))
);
drop policy if exists saved_list_items_visible on public.saved_list_items;
create policy saved_list_items_visible on public.saved_list_items for select using(
  exists(select 1 from public.saved_lists l where l.id=list_id and l.archived_at is null and
    (l.visibility='public' or (l.visibility='friends' and public.is_accepted_friend(l.user_id))))
);

create or replace function public.can_access_trip_board(p_board_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.trip_boards b where b.id=p_board_id and b.archived_at is null and (
    b.owner_id=auth.uid() or exists(select 1 from public.trip_board_members m where m.board_id=b.id and m.user_id=auth.uid()) or
    b.visibility='public' or (b.visibility='friends' and public.is_accepted_friend(b.owner_id))
  ))
$$;
revoke all on function public.can_access_trip_board(uuid) from public;
grant execute on function public.can_access_trip_board(uuid) to anon,authenticated;

create index if not exists posts_visibility_created_idx on public.posts(visibility,created_at desc) where archived_at is null;
create index if not exists reviews_visibility_venue_idx on public.reviews(visibility,venue_id,created_at desc) where archived_at is null;
create index if not exists saved_lists_discover_idx on public.saved_lists(visibility,updated_at desc) where archived_at is null;
create index if not exists user_tags_discover_idx on public.user_tags(visibility,updated_at desc) where archived_at is null;

commit;
