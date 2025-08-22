import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: 'public' } }
);

// NYC coordinates for different neighborhoods
const neighborhoods = [
  // Manhattan
  { name: "Times Square", lat: 40.7580, lng: -73.9855, weight: 3 },
  { name: "Central Park", lat: 40.7829, lng: -73.9654, weight: 2 },
  { name: "Greenwich Village", lat: 40.7323, lng: -74.0026, weight: 2 },
  { name: "SoHo", lat: 40.7223, lng: -74.0020, weight: 2 },
  { name: "Upper East Side", lat: 40.7736, lng: -73.9566, weight: 1 },
  { name: "Lower East Side", lat: 40.7150, lng: -73.9903, weight: 2 },
  { name: "Harlem", lat: 40.8116, lng: -73.9465, weight: 1 },
  
  // Brooklyn
  { name: "Williamsburg", lat: 40.7181, lng: -73.9626, weight: 2 },
  { name: "Brooklyn Bridge", lat: 40.7061, lng: -73.9969, weight: 2 },
  { name: "Park Slope", lat: 40.6656, lng: -73.9689, weight: 1 },
  { name: "DUMBO", lat: 40.7030, lng: -73.9896, weight: 1 },
  
  // Queens
  { name: "Long Island City", lat: 40.7489, lng: -73.9419, weight: 1 },
  { name: "Astoria", lat: 40.7659, lng: -73.9262, weight: 1 },
  
  // Bronx
  { name: "Yankee Stadium", lat: 40.8296, lng: -73.9262, weight: 1 },
  
  // Staten Island
  { name: "St. George", lat: 40.6419, lng: -74.0776, weight: 1 }
];

// Comprehensive demo thoughts with varied moods and content
const demoThoughts = [
  // Times Square area thoughts
  { text: "The city never sleeps, but my thoughts do", mood: "wistful", neighborhood: "Times Square" },
  { text: "Neon lights paint the night with electric dreams", mood: "energetic", neighborhood: "Times Square" },
  { text: "So many stories in these glass towers", mood: "curious", neighborhood: "Times Square" },
  { text: "Rushing through life, missing the small moments", mood: "melancholy", neighborhood: "Times Square" },
  
  // Central Park thoughts
  { text: "A peaceful moment in the concrete jungle", mood: "calm", neighborhood: "Central Park" },
  { text: "The sound of leaves whispering ancient secrets", mood: "dreamy", neighborhood: "Central Park" },
  { text: "Morning light filtering through autumn trees", mood: "hopeful", neighborhood: "Central Park" },
  { text: "City skyline framed by nature's embrace", mood: "serene", neighborhood: "Central Park" },
  
  // Greenwich Village thoughts
  { text: "Jazz notes float out of basement clubs", mood: "soulful", neighborhood: "Greenwich Village" },
  { text: "Cobblestones remember generations of dreams", mood: "nostalgic", neighborhood: "Greenwich Village" },
  { text: "Artists and poets still haunt these streets", mood: "inspired", neighborhood: "Greenwich Village" },
  
  // SoHo thoughts
  { text: "Cast iron facades tell stories of industry", mood: "contemplative", neighborhood: "SoHo" },
  { text: "Fashion and art collide in perfect harmony", mood: "vibrant", neighborhood: "SoHo" },
  { text: "Every corner holds a gallery of possibilities", mood: "optimistic", neighborhood: "SoHo" },
  
  // Brooklyn thoughts
  { text: "East River bridges connect more than just boroughs", mood: "hopeful", neighborhood: "Williamsburg" },
  { text: "Industrial spaces reborn as creative havens", mood: "transformative", neighborhood: "Williamsburg" },
  { text: "Manhattan skyline views worth the subway ride", mood: "grateful", neighborhood: "Brooklyn Bridge" },
  { text: "Waterfront walks where industry meets leisure", mood: "peaceful", neighborhood: "DUMBO" },
  
  // Other NYC thoughts
  { text: "The scent of street food and possibility", mood: "inviting", neighborhood: "Lower East Side" },
  { text: "Brownstones that have witnessed history unfold", mood: "reverent", neighborhood: "Park Slope" },
  { text: "Where the subway meets the stars", mood: "aspirational", neighborhood: "Upper East Side" },
  { text: "Cultural crossroads of the world", mood: "diverse", neighborhood: "Long Island City" },
  { text: "Baseball and community in the Bronx", mood: "passionate", neighborhood: "Yankee Stadium" },
  { text: "Staten Island ferry: the best free view in NYC", mood: "appreciative", neighborhood: "St. George" },
  { text: "Harlem's rhythm echoes through generations", mood: "resilient", neighborhood: "Harlem" }
];

// Add some thoughts without specific moods for AI to tag
const thoughtsForAITagging = [
  { text: "Coffee steam rises like morning prayers", mood: null, neighborhood: "Greenwich Village" },
  { text: "Yellow cabs dance in the rain-slicked streets", mood: null, neighborhood: "Times Square" },
  { text: "Bookstore cats guard literary treasures", mood: null, neighborhood: "Greenwich Village" },
  { text: "Street musicians compose symphonies for passersby", mood: null, neighborhood: "Central Park" },
  { text: "Fire escapes overflow with potted dreams", mood: null, neighborhood: "SoHo" }
];

// Combine all thoughts
const allThoughts = [...demoThoughts, ...thoughtsForAITagging];

async function seedDemoThoughts() {
  try {
    console.log('🌟 Seeding demo thoughts for Driftline...');
    
    const thoughtsToInsert = allThoughts.map((thought, index) => {
      // Get the neighborhood data
      const neighborhood = neighborhoods.find(n => n.name === thought.neighborhood);
      const baseLat = neighborhood?.lat || 40.7580;
      const baseLng = neighborhood?.lng || -73.9855;
      
      // Add random offset within the neighborhood
      const latOffset = (Math.random() - 0.5) * 0.005; // ~550 meters
      const lngOffset = (Math.random() - 0.5) * 0.005; // ~550 meters
      
      return {
        text: thought.text,
        mood: thought.mood,
        lat: baseLat + latOffset,
        lng: baseLng + lngOffset,
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // Random time in last 7 days
      };
    });

    console.log(`📝 Inserting ${thoughtsToInsert.length} thoughts...`);
    
    const { data, error } = await supabase
      .from('thoughts')
      .insert(thoughtsToInsert)
      .select();

    if (error) {
      console.error('❌ Error seeding demo thoughts:', error);
      return;
    }

    console.log(`✅ Successfully seeded ${data.length} demo thoughts:`);
    
    // Group thoughts by neighborhood
    const thoughtsByNeighborhood = new Map<string, typeof data>();
    data.forEach((thought) => {
      // Reverse geocode to find nearest neighborhood (simplified)
      let nearestNeighborhood = "Unknown";
      let minDistance = Infinity;
      
      neighborhoods.forEach(neighborhood => {
        const distance = Math.sqrt(
          Math.pow(thought.lat - neighborhood.lat, 2) + 
          Math.pow(thought.lng - neighborhood.lng, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestNeighborhood = neighborhood.name;
        }
      });
      
      if (!thoughtsByNeighborhood.has(nearestNeighborhood)) {
        thoughtsByNeighborhood.set(nearestNeighborhood, []);
      }
      thoughtsByNeighborhood.get(nearestNeighborhood)!.push(thought);
    });
    
    // Display thoughts by neighborhood
    thoughtsByNeighborhood.forEach((thoughts, neighborhood) => {
      console.log(`\n📍 ${neighborhood} (${thoughts.length} thoughts):`);
      thoughts.slice(0, 3).forEach((thought, index) => {
        console.log(`  ${index + 1}. "${thought.text}"${thought.mood ? ` (${thought.mood})` : ''}`);
      });
      if (thoughts.length > 3) {
        console.log(`  ... and ${thoughts.length - 3} more`);
      }
    });
    
    console.log('\n🎯 Demo seed complete! The thoughts are spread across NYC neighborhoods.');
    console.log('🚀 Ready for demo mode with varied content and moods!');
    
  } catch (error) {
    console.error('❌ Error in demo seed script:', error);
  }
}

seedDemoThoughts();