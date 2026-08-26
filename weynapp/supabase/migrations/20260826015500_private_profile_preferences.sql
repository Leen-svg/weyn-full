create table if not exists public.profile_favorite_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorite_tags text[] not null default '{}',
  visibility public.content_visibility not null default 'private',
  updated_at timestamptz not null default now()
);

insert into public.profile_favorite_preferences(user_id,favorite_tags,visibility)
select id,coalesce(favorite_tags,'{}'),coalesce(favorite_tags_visibility,'private'::public.content_visibility)
from public.profile_public
on conflict(user_id) do nothing;

-- The public profile row is widely readable for usernames and avatars. Keep
-- private recommendation preferences in their owner-scoped table instead.
update public.profile_public
set favorite_tags='{}', favorite_tags_visibility='private'::public.content_visibility
where cardinality(coalesce(favorite_tags,'{}')) > 0 or favorite_tags_visibility <> 'private'::public.content_visibility;

alter table public.profile_favorite_preferences enable row level security;
drop policy if exists profile_favorite_preferences_owner on public.profile_favorite_preferences;
create policy profile_favorite_preferences_owner on public.profile_favorite_preferences
  for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.profile_favorite_preferences to authenticated;
