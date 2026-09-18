-- Public `brand` bucket for per-restaurant logos/icons. Objects live under <org_id>/…;
-- anyone can read (the header and PWA manifest fetch them unauthenticated), only that
-- org's owners (or superadmins) may write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "brand read" on storage.objects;
create policy "brand read" on storage.objects for select
  using (bucket_id = 'brand');

drop policy if exists "brand write" on storage.objects;
create policy "brand write" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand' and is_owner((storage.foldername(name))[1]::uuid));

drop policy if exists "brand update" on storage.objects;
create policy "brand update" on storage.objects for update to authenticated
  using (bucket_id = 'brand' and is_owner((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'brand' and is_owner((storage.foldername(name))[1]::uuid));

drop policy if exists "brand delete" on storage.objects;
create policy "brand delete" on storage.objects for delete to authenticated
  using (bucket_id = 'brand' and is_owner((storage.foldername(name))[1]::uuid));
