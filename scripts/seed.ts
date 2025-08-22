import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: 'public' } }
);

// NYC coordinates (Times Square area)
const baseLat = 40.7580;
const baseLng = -73.9855;

const sampleThoughts = [
  { text: "The city never sleeps, but my thoughts do", mood: "wistful" },
  { text: "Concrete dreams and steel horizons", mood: "dreamy" },
  { text: "So many stories in these glass towers", mood: "curious" },
  { text: "Rushing through life, missing the small moments", mood: "melancholy" },
  { text: "Neon lights paint the night with electric dreams", mood: "energetic" }
];

async function seedThoughts() {
  try {
    console.log('Seeding thoughts...');
    
    const thoughtsToInsert = sampleThoughts.map((thought) => ({
      text: thought.text,
      mood: thought.mood,
      lat: baseLat + (Math.random() - 0.5) * 0.01, // Small random offset
      lng: baseLng + (Math.random() - 0.5) * 0.01, // Small random offset
    }));

    const { data, error } = await supabase
      .from('thoughts')
      .insert(thoughtsToInsert)
      .select();

    if (error) {
      console.error('Error seeding thoughts:', error);
      return;
    }

    console.log(`Successfully seeded ${data.length} thoughts:`);
    data.forEach((thought, index) => {
      console.log(`${index + 1}. "${thought.text}" at ${thought.lat.toFixed(4)}, ${thought.lng.toFixed(4)}`);
    });
    
  } catch (error) {
    console.error('Error in seed script:', error);
  }
}

seedThoughts();