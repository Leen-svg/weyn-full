alter table public.venues
  add column if not exists menu_url text;

comment on column public.venues.menu_url is
  'Optional public menu URL managed by admins and shown on venue cards.';
