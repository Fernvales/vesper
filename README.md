<div align="center">

# V E S P E R

### *Music, mapped differently.*

<br>

**An interactive music discovery experience built around connections, not lists.**

<br>

[**Live Demo**](https://vesper-dev-steel.vercel.app/) · [**Repository**](https://github.com/Fernvales/Vesper)

<br>

</div>

---

## ◌ About

Vesper turns a song into a starting point.

Instead of moving through traditional recommendation lists, Vesper maps the musical connections surrounding a track into an interactive constellation — letting you explore from one signal to the next.

> No random connections.
> No fabricated recommendations.
> Only relationships Vesper can actually establish from its music data.

---

## ✦ The Experience

**Search**

Find a song through Vesper's music catalog.

**Signal**

Start with a track and let Vesper build its surrounding universe.

**Explore**

Move through connected songs, artists, genres, and musical relationships.

**Path**

Every connection you follow becomes part of your journey through the universe.

---

## ◇ Built With

| Technology         | Purpose                         |
| ------------------ | ------------------------------- |
| **Next.js**        | Application framework           |
| **React**          | Interface                       |
| **TypeScript**     | Type safety                     |
| **Last.fm API**    | Music discovery & relationships |
| **Apple / iTunes** | Music search & previews         |
| **Deezer**         | Playback fallback               |
| **Vercel**         | Deployment                      |

---

## ◌ Local Development

Clone the repository:

```bash
git clone https://github.com/Fernvales/Vesper.git
cd Vesper
npm install
```

Create `.env.local`:

```env
LASTFM_API_KEY=your_api_key_here
```

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## ✦ Production

Vesper is deployed with Vercel.

Before deploying, configure the required environment variables in your Vercel project.

To verify a production build locally:

```bash
npm run build
```

---

## ◇ Structure

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

---

<div align="center">

### Vesper 1.0

*search → play → explore → follow the signal*

<br>

<sub>Built with music, curiosity, and a little bit of code.</sub>

</div>
