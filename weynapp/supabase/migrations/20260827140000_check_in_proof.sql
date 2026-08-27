begin;

-- Proof of presence. A check-in is only worth points if the device was
-- actually near the venue, so the position it claimed is stored alongside the
-- row: both to enforce the radius at write time and to audit later if a
-- pattern looks farmed.
alter table public.check_ins add column if not exists latitude double precision;
alter table public.check_ins add column if not exists longitude double precision;
alter table public.check_ins add column if not exists accuracy_m integer;
alter table public.check_ins add column if not exists distance_m integer;

-- Used by the impossible-travel check: find this user's previous check-in.
create index if not exists check_ins_user_recent_idx
  on public.check_ins (user_id, created_at desc);

commit;
