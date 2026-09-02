alter table public.events
  add column if not exists instagram_post_url text;

comment on column public.events.instagram_post_url is
  'Canonical public Instagram post/reel permalink extracted from admin-supplied embed code. Raw embed HTML is never stored.';
