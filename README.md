# Once Upon a Time - Online Game

An online multiplayer version of the storytelling card game "Once Upon a Time". Players take turns telling a collaborative story using cards from their hand, with the goal of steering the narrative toward their secret ending.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Authentication**: Clerk
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime
- **File Upload**: UploadThing
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript

## Features

- 🎮 Real-time multiplayer lobbies
- 🎴 Custom deck creation and management
- 🖼️ Easy image uploads for cards
- 👥 Guest and authenticated player support
- 🔄 Live lobby updates
- 🎨 Beautiful, modern UI

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd onceuponatime-antigravity
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory with the following variables:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# UploadThing
UPLOADTHING_TOKEN=your_uploadthing_token
```

4. Set up Supabase:
   - Create a new Supabase project
   - Run the migrations in the `supabase/migrations` folder
   - Configure Clerk JWT template (see `CLERK_JWT_SETUP.md`)

5. Set up UploadThing:
   - See `UPLOADTHING_SETUP.md` for detailed instructions
   - Create a free account at [uploadthing.com](https://uploadthing.com/)
   - Get your API token and add it to `.env.local`

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/                    # Next.js app router pages
│   ├── admin/             # Admin deck management
│   ├── api/               # API routes (including UploadThing)
│   └── lobbies/           # Game lobby pages
├── components/            # React components
│   ├── admin/            # Admin-specific components
│   └── lobby/            # Lobby-specific components
├── lib/                   # Utility libraries
├── supabase/             # Database types and migrations
├── utils/                # Helper functions
└── specs/                # Design specifications
```

## Documentation

- `UPLOADTHING_SETUP.md` - UploadThing integration guide
- `CLERK_JWT_SETUP.md` - Clerk authentication setup
- `TESTING_GUIDE.md` - Testing instructions
- `DECK_CREATION_FIX.md` - Deck creation troubleshooting

## Development

### Building for Production

```bash
npm run build
```

### Running Production Build

```bash
npm start
```

## Future Plans

- WebRTC integration for video chat
- Speech-to-text transcription
- Game state management
- Turn-based gameplay mechanics
- Story recording and playback

## License

This project is private and proprietary.

