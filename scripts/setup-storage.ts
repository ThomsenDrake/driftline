import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Use service role key for admin operations
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_SECRET; // Note: using _SECRET not _KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('Using', serviceRoleKey ? 'service role key' : 'anon key');
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey || anonKey
);

async function setupStorage() {
  try {
    console.log('Setting up Supabase storage bucket...');
    
    // First check if bucket exists
    const { data: existingBuckets } = await supabase.storage.listBuckets();
    const audioBucketExists = existingBuckets?.some(bucket => bucket.id === 'audio');
    
    if (audioBucketExists) {
      console.log('Audio bucket already exists, skipping creation.');
    } else {
      // Create the audio bucket using storage API
      const { data: bucket, error: bucketError } = await supabase.storage.createBucket('audio', {
        public: true,
        allowedMimeTypes: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'],
        fileSizeLimit: 10485760 // 10MB
      });

      if (bucketError) {
        console.error('Error creating bucket:', bucketError);
        return;
      } else {
        console.log('Audio bucket created successfully!', bucket);
      }
    }

    // Storage policies should be automatically set up since bucket is public
    console.log('Storage bucket setup completed successfully!');

    console.log('Storage setup completed successfully!');
    console.log('Audio bucket is ready for file uploads.');
    
  } catch (error) {
    console.error('Error in storage setup script:', error);
  }
}

setupStorage();