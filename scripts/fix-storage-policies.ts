import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_SECRET! // Use service role for admin operations
);

async function fixStoragePolicies() {
  try {
    console.log('Setting up storage policies for anonymous uploads...');
    
    // First, ensure RLS is enabled on storage.objects
    const { error: rlsError } = await supabase.rpc('sql', {
      query: `
        -- Enable RLS on storage.objects if not already enabled
        ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies to start fresh
        DROP POLICY IF EXISTS "Allow anonymous uploads to audio bucket" ON storage.objects;
        DROP POLICY IF EXISTS "Allow public access to audio files" ON storage.objects;
        
        -- Create policy for anonymous uploads to audio bucket  
        CREATE POLICY "Allow anonymous uploads to audio bucket"
        ON storage.objects
        FOR INSERT 
        TO anon
        WITH CHECK (bucket_id = 'audio');
        
        -- Create policy for public access to audio files
        CREATE POLICY "Allow public access to audio files"
        ON storage.objects
        FOR SELECT
        TO anon, authenticated
        USING (bucket_id = 'audio');
      `
    });

    if (rlsError) {
      console.error('Error setting up storage policies:', rlsError);
      return;
    }

    console.log('✅ Storage policies configured successfully!');
    console.log('Anonymous users can now upload to and read from the audio bucket.');
    
  } catch (error) {
    console.error('Error in policy setup:', error);
  }
}

fixStoragePolicies();