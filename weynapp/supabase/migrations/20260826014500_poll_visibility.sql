alter table public.polls
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists visibility public.content_visibility not null default 'public';

create index if not exists polls_visibility_creator_idx
  on public.polls(visibility,created_by,created_at desc);
