create table if not exists public.signup_notifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recipient text not null,
  source text not null default 'signup',
  sent_at timestamptz not null default now()
);

alter table public.signup_notifications enable row level security;
comment on table public.signup_notifications is 'Server-only deduplication for private new-member email notifications.';
