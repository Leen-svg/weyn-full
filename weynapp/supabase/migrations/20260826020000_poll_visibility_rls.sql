create or replace function public.can_access_poll(p_poll_id uuid, p_viewer_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.polls p
    where p.id=p_poll_id and (
      p.visibility='public' or
      (p_viewer_id is not null and p.created_by=p_viewer_id) or
      (p_viewer_id is not null and p.visibility='friends' and public.is_accepted_friend(p.created_by,p_viewer_id)) or
      (p_viewer_id is not null and exists(
        select 1 from public.group_messages gm
        join public.friend_group_members m on m.group_id=gm.group_id and m.user_id=p_viewer_id
        where gm.share_type='poll' and gm.share_id=p.id
      ))
    )
  )
$$;
revoke all on function public.can_access_poll(uuid,uuid) from public;
grant execute on function public.can_access_poll(uuid,uuid) to anon,authenticated;

drop policy if exists "read live polls" on public.polls;
create policy "read visible polls" on public.polls for select
  using(public.can_access_poll(id));

drop policy if exists "read options" on public.poll_options;
create policy "read visible poll options" on public.poll_options for select
  using(exists(select 1 from public.polls p where p.id=poll_id and public.can_access_poll(p.id)));

drop policy if exists "read votes" on public.votes;
create policy "read visible poll votes" on public.votes for select
  using(public.can_access_poll(poll_id));

-- All writes now pass through rate-limited server routes. Removing the old
-- unconditional direct-write policies prevents bypassing those controls.
drop policy if exists "create polls" on public.polls;
drop policy if exists "create options" on public.poll_options;
drop policy if exists "cast vote" on public.votes;
