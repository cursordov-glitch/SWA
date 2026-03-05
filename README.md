# ChatApp — Instagram-style Real-time Chat

A scalable, production-ready chat application built with Next.js, Supabase, and TailwindCSS.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS
- **Backend**: Supabase (Auth + Postgres + Realtime + Storage)
- **Deployment**: Vercel

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo>
cd chat-app
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in your Supabase project URL and keys from the [Supabase dashboard](https://supabase.com/dashboard).

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Folder Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Route group — no shared layout with main app
│   │   ├── login/
│   │   └── register/
│   ├── (main)/             # Route group — authenticated app shell
│   │   ├── chat/
│   │   ├── profile/
│   │   ├── search/
│   │   └── settings/
│   └── api/                # Route Handlers (REST endpoints)
│
├── components/             # Shared, reusable UI components
│   ├── ui/                 # Primitives: Button, Input, Avatar, Modal...
│   ├── layout/             # App-level layout: Sidebar, Header, BottomNav...
│   └── shared/             # Composite components used across features
│
├── features/               # Self-contained feature modules
│   ├── auth/               # Login, register, session management
│   ├── chat/               # Conversations, messages, real-time
│   ├── profile/            # User profiles, avatar upload
│   ├── notifications/      # Push, in-app notifications
│   └── media/              # Image/video upload and display
│
├── services/               # External service abstractions (Supabase calls)
│   └── *.service.ts        # Each file = one domain
│
├── lib/                    # Internal utilities and clients
│   ├── supabase/           # Browser, server, middleware clients
│   └── utils.ts            # cn(), formatDate(), etc.
│
├── hooks/                  # Global React hooks (used across features)
├── types/                  # Shared TypeScript types
└── config/                 # App-wide constants and configuration
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run type-check` | TypeScript type checking |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-only) |
| `NEXT_PUBLIC_APP_URL` | Public URL of your app |





https://swa-two.vercel.app/





