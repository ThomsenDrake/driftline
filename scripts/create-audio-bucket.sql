-- Create audio storage bucket
insert into storage.buckets (id, name, public) 
values ('audio', 'audio', true) 
on conflict (id) do nothing;

-- Storage policies for anonymous uploads
create policy if not exists "Allow anonymous uploads to audio bucket"
on storage.objects for insert 
to anon
with check (bucket_id = 'audio');

-- Allow public access to audio files
create policy if not exists "Allow public access to audio files"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'audio');