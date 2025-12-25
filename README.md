# DocuChat - AI-powered Document Analysis

A Next.js application for uploading and analyzing documents using AI.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in the `env/` directory:
   - `env/supabase.env` - Supabase configuration
   - `env/open-router.env` - OpenRouter API key

3. Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000` (default Next.js port)

To use a different port:
```bash
PORT=3001 npm run dev
```

## Environment Files

The application loads environment variables from files in the `env/` directory:

- **env/supabase.env**: Supabase project configuration
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_PROJECT_ID`

- **env/open-router.env**: OpenRouter API configuration
  - `OPENROUTER_API_KEY`

## Scripts

- `npm run dev` - Start development server with env files loaded
- `npm run build` - Build for production with env files loaded
- `npm run start` - Start production server with env files loaded
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run type-check` - TypeScript type checking

## Features

- Upload PDF and CSV documents
- Real-time document processing status
- AI-powered document analysis
- Vector search for document chunks

