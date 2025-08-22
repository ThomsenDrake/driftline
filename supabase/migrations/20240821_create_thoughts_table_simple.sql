-- Create thoughts table
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

-- Create indexes
create index if not exists thoughts_geo_idx on public.thoughts (lat, lng);
create index if not exists thoughts_created_idx on public.thoughts (created_at desc);
create index if not exists thoughts_expires_idx on public.thoughts (expires_at);

-- Enable Row Level Security
alter table public.thoughts enable row level security;

-- Create RLS policies
create policy "Public thoughts are viewable by everyone." on public.thoughts for select using (true);
create policy "Public thoughts can be inserted by authenticated users." on public.thoughts for insert with check (auth.role() = 'authenticated');
create policy "Public thoughts can be inserted by anonymous users." on public.thoughts for insert with check (auth.role() = 'anon');
create policy "Public thoughts can be updated by authenticated users." on public.thoughts for update using (auth.role() = 'authenticated');
create policy "Public thoughts can be updated by anonymous users." on public.thoughts for update using (auth.role() = 'anon');