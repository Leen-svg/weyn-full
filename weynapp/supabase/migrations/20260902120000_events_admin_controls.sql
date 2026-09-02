-- Admin event controls and multiple-day weekly recurrence.
alter table public.events
  add column if not exists website_url text,
  add column if not exists social_url text,
  add column if not exists reservation_phone text,
  add column if not exists recurrence_days smallint[] not null default '{}',
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_trending boolean not null default false,
  add column if not exists is_try_this_out boolean not null default false;

update public.events
set recurrence_days = array[extract(dow from (starts_at at time zone 'Asia/Dubai'))::smallint]
where recurrence = 'weekly' and cardinality(recurrence_days) = 0;

with ranked as (
  select id, row_number() over (order by starts_at, created_at, id) - 1 as position
  from public.events
)
update public.events as event
set sort_order = ranked.position
from ranked
where event.id = ranked.id and event.sort_order = 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_recurrence_days_check' and conrelid = 'public.events'::regclass
  ) then
    alter table public.events add constraint events_recurrence_days_check
      check (recurrence_days <@ array[0,1,2,3,4,5,6]::smallint[]);
  end if;
end $$;

create or replace function public.event_next_start(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_recurrence text,
  p_recurrence_until date,
  p_recurrence_days smallint[]
) returns timestamptz
language sql
stable
set search_path to 'public','pg_temp'
as $$
  select case
    when coalesce(p_recurrence, 'none') <> 'weekly' then
      case when p_starts_at + coalesce(p_ends_at - p_starts_at, interval '6 hours') > now() then p_starts_at else null end
    else (
      select candidate_start
      from (
        select (
          d::date + (p_starts_at at time zone 'Asia/Dubai')::time
        ) at time zone 'Asia/Dubai' as candidate_start
        from generate_series(
          greatest((p_starts_at at time zone 'Asia/Dubai')::date, (now() at time zone 'Asia/Dubai')::date - 1),
          (now() at time zone 'Asia/Dubai')::date + 14,
          interval '1 day'
        ) as d
        where extract(dow from d)::smallint = any(
          case when cardinality(p_recurrence_days) > 0 then p_recurrence_days
               else array[extract(dow from (p_starts_at at time zone 'Asia/Dubai'))::smallint] end
        )
          and (p_recurrence_until is null or d::date <= p_recurrence_until)
      ) candidates
      where candidate_start + coalesce(p_ends_at - p_starts_at, interval '6 hours') > now()
      order by candidate_start
      limit 1
    )
  end
$$;

create or replace function public.next_start(e public.events)
returns timestamptz
language sql
stable
set search_path to 'public','pg_temp'
as $$
  select public.event_next_start(e.starts_at, e.ends_at, e.recurrence, e.recurrence_until, e.recurrence_days)
$$;

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events for select using (
  is_active and public.event_next_start(starts_at, ends_at, recurrence, recurrence_until, recurrence_days) is not null
);

create index if not exists events_public_manual_order_idx on public.events(is_active, sort_order, starts_at);
