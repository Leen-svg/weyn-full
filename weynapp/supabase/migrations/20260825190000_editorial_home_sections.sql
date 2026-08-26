alter table public.editorial_lists
  add column if not exists home_section text not null default 'curated';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'editorial_lists_home_section_check'
      and conrelid = 'public.editorial_lists'::regclass
  ) then
    alter table public.editorial_lists
      add constraint editorial_lists_home_section_check
      check (home_section in ('our_picks', 'curated'));
  end if;
end $$;

update public.editorial_lists
set home_section = 'our_picks'
where home_section = 'curated'
  and (lower(title) = 'our picks' or slug = 'our-picks' or slug like 'our-picks-%');

create index if not exists editorial_lists_home_section_order_idx
  on public.editorial_lists(is_published, home_section, sort_order);
