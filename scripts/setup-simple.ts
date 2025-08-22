import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: 'public' } }
);

async function setupDatabase() {
  try {
    console.log('Setting up database...');
    
    // Create the thoughts table
    const { error: tableError } = await supabase
      .from('thoughts')
      .select('*')
      .limit(1);

    if (tableError && tableError.code === 'PGRST116') {
      // Table doesn't exist, let's create it using a direct SQL query
      const { error: createError } = await supabase
        .from('thoughts')
        .insert({
          text: 'test',
          lat: 40.7128,
          lng: -74.0060,
          created_at: new Date().toISOString()
        });

      if (createError) {
        console.error('Error creating table with test insert:', createError);
        // Try a different approach - create the table manually through the dashboard
        console.log('Please create the table manually using the SQL in schema.sql');
        return;
      }
      
      // Now delete the test record
      await supabase
        .from('thoughts')
        .delete()
        .eq('text', 'test');
      
      console.log('Database setup completed successfully!');
    } else if (!tableError) {
      console.log('Table already exists!');
    }
    
  } catch (error) {
    console.error('Error in setup script:', error);
    console.log('Please create the table manually using the SQL in schema.sql');
  }
}

setupDatabase();