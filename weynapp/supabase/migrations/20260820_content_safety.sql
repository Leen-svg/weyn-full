begin;

alter table public.posts add column if not exists status text not null default 'published';
alter table public.reviews add column if not exists status text not null default 'published';

do $$ begin
  alter table public.posts add constraint posts_status_check check (status in ('published','hidden','removed'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reviews add constraint reviews_status_check check (status in ('published','hidden','removed'));
exception when duplicate_object then null; end $$;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in ('post','review')),
  content_id uuid not null,
  reason text not null check (reason in ('inappropriate','spam','harassment','other')),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (reporter_id, content_type, content_id)
);
alter table public.content_reports enable row level security;
drop policy if exists content_reports_insert_own on public.content_reports;
create policy content_reports_insert_own on public.content_reports for insert to authenticated
  with check (auth.uid() = reporter_id);
drop policy if exists content_reports_select_own on public.content_reports;
create policy content_reports_select_own on public.content_reports for select to authenticated
  using (auth.uid() = reporter_id);

create index if not exists content_reports_target_idx on public.content_reports(content_type, content_id, status);
create index if not exists posts_status_created_idx on public.posts(status, created_at desc);
create index if not exists reviews_status_venue_idx on public.reviews(status, venue_id, created_at desc);

drop policy if exists posts_select_visible on public.posts;
create policy posts_select_visible on public.posts for select
using (
  auth.uid() = user_id
  or (
    status = 'published'
    and (
      visibility = 'public'
      or (
        visibility = 'friends' and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.addressee_id = posts.user_id)
            or (f.addressee_id = auth.uid() and f.requester_id = posts.user_id)
          )
        )
      )
    )
  )
);
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert to authenticated
with check (
  auth.uid() = user_id and status = 'published' and photo_url is null
  and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
);

drop policy if exists reviews_select_all on public.reviews;
drop policy if exists reviews_select_visible on public.reviews;
create policy reviews_select_visible on public.reviews for select
using (status = 'published' or auth.uid() = user_id);
drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews for insert to authenticated
with check (
  auth.uid() = user_id and status = 'published' and photo_url is null
  and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
);
drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and status = 'published' and photo_url is null
  and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
);

create table if not exists public.new_person_pairs (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  first_poll_id uuid references public.group_polls(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a::text < user_b::text)
);
alter table public.new_person_pairs enable row level security;

create or replace function public.award_new_people_for_vote(p_user_id uuid, p_poll_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  other_id uuid;
  user_a uuid;
  user_b uuid;
  reward_user uuid;
  inserted_count integer;
  daily_count integer;
  current_user_points integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;
  if not exists (select 1 from public.group_poll_votes where poll_id = p_poll_id and user_id = p_user_id) then
    return 0;
  end if;

  for other_id in
    select distinct user_id from public.group_poll_votes
    where poll_id = p_poll_id and user_id <> p_user_id
  loop
    if p_user_id::text < other_id::text then user_a := p_user_id; user_b := other_id;
    else user_a := other_id; user_b := p_user_id;
    end if;

    insert into public.new_person_pairs(user_a, user_b, first_poll_id)
    values (user_a, user_b, p_poll_id)
    on conflict do nothing;
    get diagnostics inserted_count = row_count;

    if inserted_count = 1 then
      foreach reward_user in array array[user_a, user_b] loop
        if not exists (select 1 from public.profiles where id = reward_user and is_banned) then
          select count(*) into daily_count from public.points_ledger
          where user_id = reward_user and reason = 'new_person'
            and created_at >= date_trunc('day', now());
          if daily_count < 3 then
            perform public.award_points(reward_user, 5, 'new_person');
            if reward_user = p_user_id then current_user_points := current_user_points + 5; end if;
          end if;
        end if;
      end loop;
    end if;
  end loop;
  return current_user_points;
end;
$$;
revoke all on function public.award_new_people_for_vote(uuid, uuid) from public;
grant execute on function public.award_new_people_for_vote(uuid, uuid) to authenticated;

commit;

