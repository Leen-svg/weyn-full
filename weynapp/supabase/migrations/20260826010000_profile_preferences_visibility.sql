alter table public.profile_public
  add column if not exists favorite_tags_visibility public.content_visibility not null default 'private';

comment on column public.profile_public.favorite_tags_visibility is
  'Controls whether selected recommendation preferences appear on the public profile.';
