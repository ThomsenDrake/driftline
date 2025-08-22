import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_SECRET!,
  { db: { schema: 'public' } }
);

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: 'public' } }
);

// NYC coordinates for different neighborhoods
const neighborhoods = [
  { name: "Times Square", lat: 40.7580, lng: -73.9855, weight: 3 },
  { name: "Central Park", lat: 40.7829, lng: -73.9654, weight: 2 },
  { name: "Greenwich Village", lat: 40.7323, lng: -74.0026, weight: 2 },
  { name: "SoHo", lat: 40.7223, lng: -74.0020, weight: 2 },
  { name: "Upper East Side", lat: 40.7736, lng: -73.9566, weight: 1 },
  { name: "Lower East Side", lat: 40.7150, lng: -73.9903, weight: 2 },
  { name: "Harlem", lat: 40.8116, lng: -73.9465, weight: 1 },
  { name: "Williamsburg", lat: 40.7181, lng: -73.9626, weight: 2 },
  { name: "Brooklyn Bridge", lat: 40.7061, lng: -73.9969, weight: 2 },
  { name: "Park Slope", lat: 40.6656, lng: -73.9689, weight: 1 },
  { name: "DUMBO", lat: 40.7030, lng: -73.9896, weight: 1 },
  { name: "Long Island City", lat: 40.7489, lng: -73.9419, weight: 1 },
  { name: "Astoria", lat: 40.7659, lng: -73.9262, weight: 1 },
  { name: "Yankee Stadium", lat: 40.8296, lng: -73.9262, weight: 1 },
  { name: "St. George", lat: 40.6419, lng: -74.0776, weight: 1 }
];

// Demo thoughts
const demoThoughts = [
  { text: "The city never sleeps, but my thoughts do", mood: "wistful", neighborhood: "Times Square" },
  { text: "Neon lights paint the night with electric dreams", mood: "energetic", neighborhood: "Times Square" },
  { text: "So many stories in these glass towers", mood: "curious", neighborhood: "Times Square" },
  { text: "Rushing through life, missing the small moments", mood: "melancholy", neighborhood: "Times Square" },
  { text: "A peaceful moment in the concrete jungle", mood: "calm", neighborhood: "Central Park" },
  { text: "The sound of leaves whispering ancient secrets", mood: "dreamy", neighborhood: "Central Park" },
  { text: "Morning light filtering through autumn trees", mood: "hopeful", neighborhood: "Central Park" },
  { text: "City skyline framed by nature's embrace", mood: "serene", neighborhood: "Central Park" },
  { text: "Jazz notes float out of basement clubs", mood: "soulful", neighborhood: "Greenwich Village" },
  { text: "Cobblestones remember generations of dreams", mood: "nostalgic", neighborhood: "Greenwich Village" },
  { text: "Artists and poets still haunt these streets", mood: "inspired", neighborhood: "Greenwich Village" },
  { text: "Cast iron facades tell stories of industry", mood: "contemplative", neighborhood: "SoHo" },
  { text: "Fashion and art collide in perfect harmony", mood: "vibrant", neighborhood: "SoHo" },
  { text: "Every corner holds a gallery of possibilities", mood: "optimistic", neighborhood: "SoHo" },
  { text: "East River bridges connect more than just boroughs", mood: "hopeful", neighborhood: "Williamsburg" },
  { text: "Industrial spaces reborn as creative havens", mood: "transformative", neighborhood: "Williamsburg" },
  { text: "Manhattan skyline views worth the subway ride", mood: "grateful", neighborhood: "Brooklyn Bridge" },
  { text: "Waterfront walks where industry meets leisure", mood: "peaceful", neighborhood: "DUMBO" },
  { text: "The scent of street food and possibility", mood: "inviting", neighborhood: "Lower East Side" },
  { text: "Brownstones that have witnessed history unfold", mood: "reverent", neighborhood: "Park Slope" },
  { text: "Where the subway meets the stars", mood: "aspirational", neighborhood: "Upper East Side" },
  { text: "Cultural crossroads of the world", mood: "diverse", neighborhood: "Long Island City" },
  { text: "Baseball and community in the Bronx", mood: "passionate", neighborhood: "Yankee Stadium" },
  { text: "Staten Island ferry: the best free view in NYC", mood: "appreciative", neighborhood: "St. George" },
  { text: "Harlem's rhythm echoes through generations", mood: "resilient", neighborhood: "Harlem" },
  { text: "Coffee steam rises like morning prayers", mood: null, neighborhood: "Greenwich Village" },
  { text: "Yellow cabs dance in the rain-slicked streets", mood: null, neighborhood: "Times Square" },
  { text: "Bookstore cats guard literary treasures", mood: null, neighborhood: "Greenwich Village" },
  { text: "Street musicians compose symphonies for passersby", mood: null, neighborhood: "Central Park" },
  { text: "Fire escapes overflow with potted dreams", mood: null, neighborhood: "SoHo" }
];

async function createTables() {
  try {
    console.log('🗄️ Creating database tables...');
    
    // Create thoughts table
    const { error: thoughtsError } = await supabaseService
      .from('thoughts')
      .select('id')
      .limit(1);

    if (thoughtsError && thoughtsError.code === 'PGRST116') {
      console.log('Thoughts table does not exist, creating it...');
      
      // Use the SQL from schema.sql
      const createTableSQL = `
        create table if not exists public.thoughts (
          id uuid primary key default gen_random_uuid(),
          text varchar(200) not null,
          audio_url text,
          lat double precision not null,
          lng double precision not null,
          mood text,
          created_at timestamptz not null default now(),
          expires_at timestamptz not null default (now() + interval '24 hours')
        );

        create index if not exists thoughts_geo_idx on public.thoughts using gist (ll_to_earth(lat, lng));
        create index if not exists thoughts_created_idx on public.thoughts (created_at desc);
        create index if not exists thoughts_expires_idx on public.thoughts (expires_at);

        alter table public.thoughts enable row level security;
        create policy "insert_thoughts" on public.thoughts for insert to anon, authenticated using (true) with check (true);
        create policy "read_thoughts" on public.thoughts for select to anon, authenticated using (true);
      `;

      // For Supabase, we need to use the RPC method with proper SQL
      const { error: sqlError } = await supabaseService
        .rpc('exec', { code: createTableSQL });

      if (sqlError) {
        console.error('Error creating tables:', sqlError);
        return false;
      }
      
      console.log('✅ Tables created successfully!');
    } else if (!thoughtsError) {
      console.log('✅ Tables already exist!');
    }
    
    return true;
  } catch (error) {
    console.error('Error creating tables:', error);
    return false;
  }
}

async function seedDemoData() {
  try {
    console.log('🌟 Seeding demo thoughts...');
    
    const thoughtsToInsert = demoThoughts.map((thought, index) => {
      const neighborhood = neighborhoods.find(n => n.name === thought.neighborhood);
      const baseLat = neighborhood?.lat || 40.7580;
      const baseLng = neighborhood?.lng || -73.9855;
      
      const latOffset = (Math.random() - 0.5) * 0.005;
      const lngOffset = (Math.random() - 0.5) * 0.005;
      
      return {
        text: thought.text,
        mood: thought.mood,
        lat: baseLat + latOffset,
        lng: baseLng + lngOffset,
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    const { data, error } = await supabasePublic
      .from('thoughts')
      .insert(thoughtsToInsert)
      .select();

    if (error) {
      console.error('❌ Error seeding demo thoughts:', error);
      return false;
    }

    console.log(`✅ Successfully seeded ${data.length} demo thoughts!`);
    
    // Show some examples
    console.log('\n📍 Sample demo thoughts:');
    data.slice(0, 5).forEach((thought, index) => {
      console.log(`  ${index + 1}. "${thought.text}"${thought.mood ? ` (${thought.mood})` : ''}`);
    });
    
    return true;
  } catch (error) {
    console.error('Error seeding demo data:', error);
    return false;
  }
}

async function setupDemo() {
  console.log('🚀 Starting Driftline demo setup...\n');
  
  // Create tables
  const tablesCreated = await createTables();
  if (!tablesCreated) {
    console.log('❌ Failed to create tables. Please check your Supabase setup.');
    return;
  }
  
  // Seed demo data
  const dataSeeded = await seedDemoData();
  if (!dataSeeded) {
    console.log('❌ Failed to seed demo data.');
    return;
  }
  
  console.log('\n🎉 Demo setup complete!');
  console.log('🎯 Ready for demo mode with 25+ thoughts across NYC!');
  console.log('🚀 Start the app with: pnpm dev');
  console.log('🎬 Click the Demo button for a 60-second showcase!');
}

setupDemo();