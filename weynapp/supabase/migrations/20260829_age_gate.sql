-- Age gate: self-declared date of birth + an explicit opt-in for 21+ venues.
--
-- Two separate questions, because they are two separate facts:
--   birthdate      -> what the user is legally allowed to see (hard limit)
--   show_21_plus   -> what the user actually wants to see (soft preference)
-- A 25-year-old who does not drink gets an all-ages app; an under-21 user
-- cannot opt in at all. The preference can never widen what the age allows.
--
-- birthdate lives on `profiles` (private, RLS select-own, no user write policy)
-- and never on `profile_public`, which is world-readable. Age submission goes
-- through a service-role route so the client cannot backdate itself.

alter table public.profiles
  add column if not exists birthdate date,
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists show_21_plus boolean not null default false;

comment on column public.profiles.birthdate is
  'Self-declared DOB from onboarding. Personal data under PDPL: never expose via profile_public or any venue-facing product.';
comment on column public.profiles.show_21_plus is
  'User asked to see licensed / 21+ venues. Only honoured when birthdate proves 21+.';

-- Guard against a birthdate that is in the future or implausibly old.
alter table public.profiles drop constraint if exists profiles_birthdate_sane;
alter table public.profiles add constraint profiles_birthdate_sane
  check (birthdate is null or (birthdate > '1900-01-01' and birthdate <= current_date));

-- Backfill venue access tiers from the tags that already carry the signal.
-- UAE drinking age is 21 in Dubai and Abu Dhabi; shisha is 18.
-- Order matters: shisha first, then licensed, so a venue that is both ends up
-- at the stricter 21-plus tier.
update public.venues v
set age_restriction = '18-plus'
where v.age_restriction = 'all-ages'
  and exists (
    select 1 from public.venue_tags vt
    join public.vibe_tags t on t.id = vt.tag_id
    where vt.venue_id = v.id and t.display_name = 'Shisha Served'
  );

update public.venues v
set age_restriction = '21-plus'
where v.age_restriction in ('all-ages', '18-plus')
  and exists (
    select 1 from public.venue_tags vt
    join public.vibe_tags t on t.id = vt.tag_id
    where vt.venue_id = v.id and t.display_name = 'Licensed (Serves Alcohol)'
  );
