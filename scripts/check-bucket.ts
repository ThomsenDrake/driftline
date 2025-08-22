import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkBucket() {
  try {
    console.log('Checking for audio bucket...');
    
    // List all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return;
    }
    
    console.log('All buckets:', buckets);
    
    // Check for audio bucket
    const audioBucket = buckets?.find(b => b.id === 'audio');
    if (audioBucket) {
      console.log('✅ Audio bucket found:', audioBucket);
    } else {
      console.log('❌ Audio bucket NOT found');
    }
    
    // Try to upload a test file
    console.log('\nTesting upload capability...');
    const testBlob = new Blob(['test'], { type: 'audio/webm' });
    const testFileName = `test-${Date.now()}.webm`;
    
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(testFileName, testBlob);
    
    if (uploadError) {
      console.error('Upload test failed:', uploadError);
    } else {
      console.log('✅ Upload test successful!');
      
      // Clean up test file
      await supabase.storage.from('audio').remove([testFileName]);
      console.log('Test file cleaned up');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkBucket();