-- Lets a group's creator delete the whole group. Previously friend_groups had
-- no delete policy at all, so DELETE /api/groups/[id] could only ever remove
-- the caller's own membership row (leaving), never the group itself.
create policy "creator can delete their own group" on public.friend_groups
  for delete
  using (created_by = auth.uid());
