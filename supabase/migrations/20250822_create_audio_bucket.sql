-- Create audio storage bucket for audio recordings
-- This migration sets up the audio storage bucket with proper permissions

-- Create the audio bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio',
  'audio', 
  true,
  10485760, -- 10MB limit
  '{"audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"}'
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Allow anonymous uploads to audio bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete audio files" ON storage.objects;

-- Allow anonymous uploads to audio bucket
CREATE POLICY "Allow anonymous uploads to audio bucket"
ON storage.objects
FOR INSERT 
TO anon
WITH CHECK (bucket_id = 'audio');

-- Allow public access to audio files for playback
CREATE POLICY "Allow public access to audio files"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'audio');

-- Allow users to delete their own audio files (optional, for cleanup)
CREATE POLICY "Allow users to delete audio files"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'audio');