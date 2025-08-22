# Driftline

A real-time anonymous social map application where users share location-based thoughts that expire after 24 hours. Built with Next.js 15, Supabase, and MapLibre GL.

## Features

- **Anonymous Thoughts**: Share thoughts at your location without creating an account
- **Audio Recording**: Add 10-second voice notes to your thoughts
- **AI Mood Detection**: Automatic mood tagging using Z.AI API with rule-based fallback
- **Real-time Updates**: See new thoughts appear instantly via Supabase real-time
- **Interactive Map**: Explore thoughts on a MapLibre GL-powered map
- **24-Hour Expiration**: All thoughts automatically delete after 24 hours
- **Mood-based Visualization**: Thoughts display with colors based on detected mood
- **Content Moderation**: Built-in profanity filtering and reporting system

## Tech Stack

- **Frontend**: Next.js 15 with Turbopack, TypeScript, React 19
- **Styling**: Tailwind CSS with custom mood-based theming
- **Database**: Supabase (PostgreSQL + real-time subscriptions)
- **Storage**: Supabase Storage for audio files
- **Maps**: MapLibre GL for interactive mapping
- **AI**: Z.AI GLM-4.5 for mood analysis
- **Audio**: MediaRecorder API for browser-based recording

## Prerequisites

- Node.js 18+ 
- pnpm package manager
- Supabase account
- Z.AI API key (optional - will fallback to rule-based mood detection)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd driftline
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env.local` file with the following variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_SECRET=your_supabase_service_role_key
   ZAI_API_KEY=your_zai_api_key
   ZAI_MODEL=glm-4.5
   ```

4. **Database Setup**
   ```bash
   # Set up database tables and policies
   pnpm tsx scripts/setup-database.ts
   
   # Optional: Seed with sample data
   pnpm tsx scripts/seed.ts
   ```

5. **Storage Setup**
   ```bash
   # Create audio storage bucket
   pnpm tsx scripts/setup-storage.ts
   ```
   
   Or follow the manual setup guide in [`STORAGE_SETUP.md`](./STORAGE_SETUP.md)

## Development

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

```bash
pnpm dev                           # Start dev server with Turbopack
pnpm build                         # Create production build  
pnpm start                         # Serve production build
pnpm lint                          # Run ESLint

# Database & Setup
pnpm tsx scripts/setup-database.ts # Initialize database tables/policies
pnpm tsx scripts/setup-storage.ts  # Create audio storage bucket
pnpm tsx scripts/seed.ts           # Seed sample data
pnpm tsx scripts/demo-seed.ts      # Seed demo data for presentations

# Utilities
node scripts/cleanup-cron.js       # Clean up expired thoughts
pnpm tsx scripts/setup-demo.ts     # Complete demo setup
```

## Project Structure

```
src/
├── app/
│   ├── api/                      # API routes
│   │   ├── thoughts/             # Thought CRUD operations
│   │   ├── mood-tag/             # AI mood detection
│   │   ├── thoughts-in-bounds/   # Geo-filtered thoughts
│   │   └── vibe-summary/         # Area vibe generation
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/
│   ├── MapLibreMap.tsx           # Main map component
│   ├── ThoughtForm.tsx           # Thought submission form
│   ├── VibeSummary.tsx           # Area vibe display
│   └── DriftMode.tsx             # Ambient tour mode
├── hooks/
│   └── useGeolocator.ts          # Location services
└── lib/
    ├── supabase.ts               # Supabase client
    ├── profanity-filter.ts       # Content moderation
    └── rate-limiter.ts           # API rate limiting
```

## Key Components

### MapLibreMap
The main interactive map component featuring:
- Real-time thought visualization with mood-based colors
- User location detection and markers
- Thought submission with audio recording
- Smooth animations and custom styling

### Mood Detection
Automatic mood tagging system with:
- Primary: Z.AI GLM-4.5 API integration
- Fallback: Rule-based keyword detection
- Supported moods: happy, sad, excited, angry, peaceful, anxious, hopeful, frustrated, content, energetic, nostalgic

### Audio Recording
Browser-based audio capture with:
- 10-second maximum duration
- Real-time recording timer
- WebM format output
- Supabase storage upload

## API Routes

- `POST /api/thoughts` - Submit new thoughts
- `POST /api/mood-tag` - Generate mood tags for text
- `GET /api/thoughts-in-bounds` - Fetch thoughts within map bounds
- `POST /api/vibe-summary` - Generate area vibe summaries
- `POST /api/reports` - Report inappropriate content
- `POST /api/cleanup-expired` - Clean up expired thoughts

## Database Schema

### thoughts table
```sql
- id: uuid (primary key)
- text: varchar(200) 
- audio_url: text (optional)
- lat: double precision
- lng: double precision  
- mood: text (optional)
- created_at: timestamptz
- expires_at: timestamptz (24 hours from creation)
```

### Storage
- `audio` bucket: Stores audio recordings with anonymous upload policies

## Deployment

### Environment Variables
Ensure all environment variables are set in your deployment platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
- `SUPABASE_SERVICE_ROLE_SECRET`
- `ZAI_API_KEY` (optional)
- `ZAI_MODEL`

### Supabase Setup
1. Create tables using `scripts/setup-database.ts`
2. Set up storage bucket using `scripts/setup-storage.ts`
3. Configure Row Level Security policies
4. Set up real-time subscriptions

### Vercel Deployment
The app is optimized for Vercel deployment:

```bash
pnpm build
```

Configure environment variables in Vercel dashboard and deploy.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[MIT License](LICENSE)

## Support

For questions or issues, please check the existing documentation:
- [`CLAUDE.md`](./CLAUDE.md) - Development guide for Claude Code
- [`STORAGE_SETUP.md`](./STORAGE_SETUP.md) - Audio storage configuration