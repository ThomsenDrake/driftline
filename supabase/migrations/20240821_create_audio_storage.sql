-- Create storage bucket for audio files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', true, 52428800, ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'])
on conflict (id) do nothing;

-- Set up RLS policies for audio storage
create policy "Anyone can view audio files." on storage.objects for select using (bucket_id = 'audio');
create policy "Anyone can upload audio files." on storage.objects for insert with check (
  bucket_id = 'audio' 
  and (auth.role() = 'authenticated' or auth.role() = 'anon')
);
create policy "Anyone can update audio files." on storage.objects for update using (
  bucket_id = 'audio' 
  and (auth.role() = 'authenticated' or auth.role() = 'anon')
);
create policy "Anyone can delete audio files." on storage.objects for delete using (
  bucket_id = 'audio' 
  and (auth.role() = 'authenticated' or auth.role() = 'anon')
);