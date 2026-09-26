# Vesper

**Music, mapped differently.**

Vesper is a music discovery experience that visualizes connections between songs as an interactive constellation.

Instead of browsing music through traditional lists, Vesper turns a song into a starting point and maps the signals around it — similar tracks, artists, genres, and other relationships found through real music data.

No random connections. No fabricated recommendations. Just the music data Vesper can actually establish.

## What it does

* **Search for music** through a large catalog of songs
* **Preview and play tracks** directly in the experience
* **Explore a song universe** through connected music
* **Follow connections** from one song to another
* **Build a path** as you move through the universe
* **Upload local audio** for a private, device-only listening experience
* **Discover connections through Last.fm** and other music data sources

## Built with

* Next.js
* React
* TypeScript
* Last.fm API
* Apple Music / iTunes data
* Deezer
* Vercel

## The idea

Most music discovery interfaces are built around lists, search results, and recommendation feeds.

Vesper takes a different approach.

A song becomes a point in a larger musical space. From there, you can follow connections and see where the signal leads.

The goal isn't to replace the way people listen to music — it's to make the relationships between songs something you can explore.

## Local development

Clone the repository and install the dependencies:

```bash
npm install
```

Create a `.env.local` file and add your Last.fm API key:

```env
LASTFM_API_KEY=your_api_key_here
```

Then start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Production

Vesper is deployed with Vercel.

Before deploying, make sure the required environment variables are configured in the Vercel project.

Build locally with:

```bash
npm run build
```

## Project structure

```text
app/
├── api/
│   └── music/
├── components/
├── lib/
├── song/
│   ├── [trackId]/
│   └── uploaded/
├── globals.css
└── page.tsx
```

## Status

**Vesper 1.0**

The first release is focused on the core experience:

**search → play → explore → follow the signal**

## License

This project is currently provided as-is.

