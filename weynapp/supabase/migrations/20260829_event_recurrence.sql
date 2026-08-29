-- Weekly recurrence for events.
--
-- A residency ("every Friday until 25 Dec") is one row, not 16. Storing a rule
-- rather than materialised occurrences means editing the night edits the whole
-- series, and there is no backlog of stale rows to prune.
--
-- The trade-off is that `starts_at` alone no longer tells you whether an event
-- is live — it is the *first* date the series ever ran. Everything therefore
-- resolves through event_next_start(), including the RLS policy, so no query
-- can accidentally advertise a night that has already happened.

alter table public.events
  add column if not exists recurrence text not null default 'none',
  add column if not exists recurrence_until date;

alter table public.events drop constraint if exists events_recurrence_valid;
alter table public.events add constraint events_recurrence_valid
  check (recurrence in ('none','weekly'));

-- Returns the occurrence still worth showing, or null when there is none.
--
-- The duration of the first occurrence defines every later one, and the search
-- is anchored on the window END rather than the start — otherwise an event
-- happening right now would be skipped forward a week mid-party.
create or replace function public.event_next_start(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_recurrence text,
  p_recurrence_until date
) returns timestamptz
language sql
stable
set search_path to 'public','pg_temp'
as $$
  with d as (
    select coalesce(p_ends_at - p_starts_at, interval '6 hours') as dur
  ),
  step as (
    select greatest(0, ceil(
      extract(epoch from (now() - p_starts_at - (select dur from d))) / 604800.0
    ))::int as weeks
  )
  select case
    when coalesce(p_recurrence, 'none') <> 'weekly' then
      case when p_starts_at + (select dur from d) > now() then p_starts_at else null end
    when p_recurrence_until is not null
         and (p_starts_at + ((select weeks from step) * interval '1 week'))::date > p_recurrence_until
      then null
    else p_starts_at + ((select weeks from step) * interval '1 week')
  end
$$;

-- A function taking the row type is exposed by PostgREST as a computed field,
-- so clients can select `next_start` on `events` and keep embedded joins such
-- as venues(...) — which PostgREST cannot infer through a view.
create or replace function public.next_start(e public.events)
returns timestamptz
language sql
stable
set search_path to 'public','pg_temp'
as $$
  select public.event_next_start(e.starts_at, e.ends_at, e.recurrence, e.recurrence_until)
$$;

-- Expiry now means "the series has nothing left", not "the first date passed".
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select
  using (
    is_active
    and public.event_next_start(starts_at, ends_at, recurrence, recurrence_until) is not null
  );

drop view if exists public.events_live;
create view public.events_live
with (security_invoker = true)
as
select
  e.*,
  public.event_next_start(e.starts_at, e.ends_at, e.recurrence, e.recurrence_until) as next_start
from public.events e
where e.is_active
  and public.event_next_start(e.starts_at, e.ends_at, e.recurrence, e.recurrence_until) is not null;

grant select on public.events_live to anon, authenticated;
