alter table public.events
  alter column title drop not null,
  alter column starts_at drop not null,
  add column if not exists draft_data jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_published_fields_check' and conrelid = 'public.events'::regclass
  ) then
    alter table public.events add constraint events_published_fields_check
      check (not is_active or (nullif(btrim(title), '') is not null and starts_at is not null));
  end if;
end $$;

comment on column public.events.draft_data is
  'Bounded admin editor state retained for incomplete unpublished events. Cleared when the event is published.';
