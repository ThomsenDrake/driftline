import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_SECRET!
);

async function runSQL() {
  try {
    console.log('Running SQL migration...');
    
    // Read the migration file
    const sqlContent = readFileSync('supabase/migrations/20250822_create_audio_bucket.sql', 'utf8');
    
    // Split into individual statements and run them
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        
        const { error } = await supabase.rpc('query', {
          query: statement
        });
        
        if (error) {
          console.error('Error executing statement:', error);
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }
    
    console.log('Migration completed!');
    
  } catch (error) {
    console.error('Error running SQL:', error);
  }
}

runSQL();