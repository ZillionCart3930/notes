# Setup Guide

## Prerequisites
- Node.js 18+ and npm
- `ffmpeg` (for audio transcoding): `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Linux)
- Optional: local `whisper.cpp` server running on port 8080 (for audio transcription)

## Environment Setup

### 1. Create your `.env` file
Copy the example config:
```bash
cp .env.example .env
```

### 2. Add your API keys to `.env`

**OpenRouter API Key (required for "Turn into notes" button):**
1. Sign up at https://openrouter.ai
2. Go to your account dashboard
3. Create an API key
4. Paste it into `.env`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

**Gemini API Key (optional, for text-only summarization fallback):**
1. Create a project at https://ai.google.dev
2. Generate an API key
3. Add to `.env`:
   ```
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

**Supabase (optional, for cloud sync):**
Already configured in `.env.example` — see the Supabase section.

## Running the Application

### Development
```bash
# Terminal 1: Start the backend API server
OPENROUTER_API_KEY=sk-or-v1-... npm run start:api

# Terminal 2: Start the frontend dev server
npm run dev
```

The frontend will proxy `/api/*` calls to `http://localhost:4000`.

### With Local Whisper Transcription (optional)
If you have `whisper.cpp` running on port 8080:
```bash
# Terminal 1: Start whisper.cpp server
cd /path/to/whisper.cpp
./server -m models/ggml-base.en.bin --port 8080

# Terminal 2: Start the backend API
OPENROUTER_API_KEY=sk-or-v1-... npm run start:api

# Terminal 3: Start the frontend
npm run dev
```

## Production Deployment

### Important: Secure Your API Keys
- **Never commit `.env` to Git** — it's in `.gitignore` for a reason
- **Set environment variables** in your hosting platform (Vercel, Netlify, Railway, etc.)
- **Rotate exposed keys** immediately if they're ever checked into version control or pasted in chat

### Example: Vercel
1. Go to Project Settings → Environment Variables
2. Add `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, etc.
3. Deploy normally — the server will read from the platform's env vars

### Example: Docker
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 4000 5173
CMD ["npm", "start:api"]
```

Then run with:
```bash
docker run \
  -e OPENROUTER_API_KEY=sk-or-v1-... \
  -e GEMINI_API_KEY=... \
  -p 4000:4000 \
  my-notes-app
```

## Troubleshooting

**"Local transcription engine offline" error:**
- Ensure `whisper.cpp` is running on port 8080, or disable audio upload (the speech recognition fallback will still work)

**"OpenRouter API returned an error" error:**
- Check that `OPENROUTER_API_KEY` is set and valid
- Verify you have credits/balance on OpenRouter
- Try a fresh API key if needed

**"Turn into notes" button does nothing:**
- Open browser DevTools → Network tab
- Check the `/api/notes` response for error details
- Ensure the backend is running (`npm run start:api`)

## Build & Deploy

```bash
# Build the frontend
npm run build

# The built files are in ./dist
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, etc.).
For the backend API, run a Node.js server or deploy to Render, Railway, Heroku, etc.
