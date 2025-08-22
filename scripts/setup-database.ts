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
    const { error: tableError } = await supabase.rpc('exec', {
      code: `
        create table if not exists public.thoughts (
          id uuid primary key default gen_random_uuid(),
          text varchar(200) not null,
          audio_url text,
          lat double precision not null,
          lng double precision not null,
          mood text,
          created_at timestamptz not null default now()
        );

        create index if not exists thoughts_geo_idx on public.thoughts using gist (ll_to_earth(lat, lng));
        create index if not exists thoughts_created_idx on public.thoughts (created_at desc);

        alter table public.thoughts enable row level security;
        create policy "insert_thoughts" on public.thoughts for insert to anon, authenticated using (true) with check (true);
        create policy "read_thoughts" on public.thoughts for select to anon, authenticated using (true);
      `
    });

    if (tableError) {
      console.error('Error creating table:', tableError);
      return;
    }

    console.log('Database setup completed successfully!');
    
  } catch (error) {
    console.error('Error in setup script:', error);
  }
}

setupDatabase();