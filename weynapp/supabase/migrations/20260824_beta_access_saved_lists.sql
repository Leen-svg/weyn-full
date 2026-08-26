begin;

create table if not exists public.beta_invitation_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  label text,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.beta_invitation_codes enable row level security;

create or replace function public.redeem_beta_invitation(invitation_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.beta_invitation_codes
  set use_count = use_count + 1
  where id = invitation_id and is_active and use_count < max_uses and (expires_at is null or expires_at > now());
  return found;
end $$;
revoke all on function public.redeem_beta_invitation(uuid) from public;

create table if not exists public.legal_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  beta_acknowledged boolean not null,
  accepted_at timestamptz not null default now()
);
alter table public.legal_consents enable row level security;
create policy legal_consents_own_read on public.legal_consents for select to authenticated using (user_id=auth.uid());

create or replace function public.capture_signup_consent() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if coalesce((new.raw_user_meta_data->>'beta_acknowledged')::boolean, false) then
    insert into public.legal_consents(user_id, terms_version, privacy_version, beta_acknowledged, accepted_at)
    values(new.id, coalesce(new.raw_user_meta_data->>'terms_version','2026-08-22'), coalesce(new.raw_user_meta_data->>'privacy_version','2026-08-22'), true, now())
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists capture_signup_consent_trigger on auth.users;
create trigger capture_signup_consent_trigger after insert on auth.users for each row execute function public.capture_signup_consent();

create table if not exists public.saved_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '',
  tags text[] not null default '{}',
  visibility text not null default 'private' check (visibility in ('private','friends','public')),
  share_slug text not null unique default encode(gen_random_bytes(9),'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.saved_list_items (
  list_id uuid not null references public.saved_lists(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key(list_id, venue_id)
);
create table if not exists public.saved_list_group_shares (
  list_id uuid references public.saved_lists(id) on delete cascade,
  group_id uuid references public.friend_groups(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(list_id, group_id)
);
create table if not exists public.saved_list_friend_shares (
  list_id uuid references public.saved_lists(id) on delete cascade,
  friend_id uuid references auth.users(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(list_id, friend_id)
);
alter table public.saved_lists enable row level security;
alter table public.saved_list_items enable row level security;
alter table public.saved_list_group_shares enable row level security;
alter table public.saved_list_friend_shares enable row level security;
create policy saved_lists_owner on public.saved_lists for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy saved_list_items_owner on public.saved_list_items for all to authenticated
  using(exists(select 1 from public.saved_lists l where l.id=list_id and l.user_id=auth.uid()))
  with check(exists(select 1 from public.saved_lists l where l.id=list_id and l.user_id=auth.uid()));
create policy saved_group_shares_owner on public.saved_list_group_shares for all to authenticated
  using(shared_by=auth.uid()) with check(shared_by=auth.uid());
create policy saved_friend_shares_owner on public.saved_list_friend_shares for all to authenticated
  using(shared_by=auth.uid()) with check(shared_by=auth.uid());

alter table public.posts add column if not exists saved_list_id uuid references public.saved_lists(id) on delete set null;
alter table public.posts alter column venue_id drop not null;

commit;

