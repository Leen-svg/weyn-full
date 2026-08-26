alter table public.group_messages
  drop constraint if exists group_messages_share_type_check;

alter table public.group_messages
  add constraint group_messages_share_type_check
  check (share_type is null or share_type in ('venue','saved_list','trip_board','poll'));
