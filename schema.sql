-- schema driftline
create table if not exists public.thoughts (
  id uuid primary key default gen_random_uuid(),
  text varchar(200) not null,
  audio_url text,
  lat double precision not null,
  lng double precision not null,
  mood text, -- single word tag like 'wistful'
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

-- Add index for expiration cleanup
create index if not exists thoughts_expires_idx on public.thoughts (expires_at);

-- Reports table for content moderation
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  thought_id uuid not null references public.thoughts(id) on delete cascade,
  reason text not null, -- reason for reporting (spam, harassment, etc.)
  details text, -- additional context
  created_at timestamptz not null default now(),
  ip_address text, -- for moderation purposes
  status text default 'pending' check (status in ('pending', 'reviewed', 'resolved')),
  reviewed_at timestamptz,
  reviewed_by text
);

-- Indexes for reports
create index if not exists reports_thought_idx on public.reports (thought_id);
create index if not exists reports_created_idx on public.reports (created_at desc);
create index if not exists reports_status_idx on public.reports (status);

-- Indexes
create index if not exists thoughts_geo_idx on public.thoughts using gist (ll_to_earth(lat, lng));
create index if not exists thoughts_created_idx on public.thoughts (created_at desc);

-- RLS: allow insert/select to everyone, no delete/update
alter table public.thoughts enable row level security;
create policy "insert_thoughts" on public.thoughts for insert to anon, authenticated using (true) with check (true);
create policy "read_thoughts"   on public.thoughts for select to anon, authenticated using (true);