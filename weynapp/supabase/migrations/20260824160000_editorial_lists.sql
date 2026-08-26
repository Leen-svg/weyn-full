create table if not exists public.editorial_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  subtitle text check (char_length(subtitle) <= 240),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  city text not null check (city in ('Dubai', 'Abu Dhabi')),
  header_image_url text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.editorial_list_items (
  list_id uuid not null references public.editorial_lists(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  primary key (list_id, venue_id)
);

create index if not exists editorial_lists_published_order_idx on public.editorial_lists(is_published, city, sort_order);
create index if not exists editorial_list_items_order_idx on public.editorial_list_items(list_id, position);

alter table public.editorial_lists enable row level security;
alter table public.editorial_list_items enable row level security;

drop policy if exists editorial_lists_public_read on public.editorial_lists;
create policy editorial_lists_public_read on public.editorial_lists for select
using (is_published = true or exists(select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists editorial_list_items_public_read on public.editorial_list_items;
create policy editorial_list_items_public_read on public.editorial_list_items for select
using (exists(select 1 from public.editorial_lists where id = list_id and is_published = true)
  or exists(select 1 from public.profiles where id = auth.uid() and is_admin = true));
