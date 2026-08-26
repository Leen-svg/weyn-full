begin;

create table if not exists public.request_rate_limits (
  key_hash text not null,
  action text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 1 check (hits > 0),
  primary key (key_hash, action)
);

alter table public.request_rate_limits enable row level security;
revoke all on table public.request_rate_limits from public, anon, authenticated;

create or replace function public.consume_request_rate_limit(
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.request_rate_limits%rowtype;
begin
  if length(p_key_hash) <> 64 or p_action = '' or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.request_rate_limits as limits (key_hash, action, window_start, hits)
  values (p_key_hash, left(p_action, 80), v_now, 1)
  on conflict (key_hash, action) do update
  set window_start = case
        when limits.window_start <= v_now - make_interval(secs => p_window_seconds) then v_now
        else limits.window_start
      end,
      hits = case
        when limits.window_start <= v_now - make_interval(secs => p_window_seconds) then 1
        else limits.hits + 1
      end
  returning * into v_row;

  return v_row.hits <= p_limit;
end;
$$;

revoke all on function public.consume_request_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_request_rate_limit(text, text, integer, integer) to service_role;

create index if not exists request_rate_limits_window_idx on public.request_rate_limits (window_start);

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
where id = 'venue-media';

commit;


