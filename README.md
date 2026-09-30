# Vesper

### Music, mapped differently.

<p align="center">
  <img src="./public/screenshots/home.PNG" alt="Vesper home screen" width="100%">
</p>

<p align="center">
  <i>Search a song. Explore the music around it.</i>
</p>

---

## What is Vesper?

Most music discovery gives you a list. Vesper gives you a map.

Search for any song and it becomes the center of an interactive universe. Related songs and artists orbit around it as connected signals, so you find new music by following the connections instead of scrolling through results.

> Music discovery should feel like exploration.

---

## Explore the universe

<p align="center">
  <img src="./public/screenshots/universe.PNG" alt="Vesper song universe" width="100%">
</p>

Every song is a center point. Vesper pulls real music data to place related artists and tracks around your selection, then lets you explore outward and see where the music leads.

---

## Listen as you go

<p align="center">
  <img src="./public/screenshots/signal.PNG" alt="Vesper song signal" width="100%">
</p>

Pick a signal and it plays right there. Discovery and listening happen in the same place, so finding something new never means leaving the experience.

---

## The look

Vesper is meant to feel less like a web app and more like stepping into another space: dark celestial visuals, subtle motion, orbital layouts, careful typography, and a restrained color palette.

---

## How it works

No single API does everything, so Vesper combines several, each doing the job it's best at.

| Step | Service | What it does |
|---|---|---|
| Search | iTunes / Deezer | Finds the song you're looking for |
| Relationships | Last.fm | Finds related songs and artists |
| Metadata | Deezer | Fills in song and artist details |
| Playback | SoundCloud | Plays the selected signal |

```text
  SEARCH  (iTunes / Deezer)
     │
     ▼
  SELECT A SONG
     │
     ▼
  SONG + ARTIST METADATA
     │
     ├── Last.fm     → relationships
     ├── Deezer      → metadata
     └── SoundCloud  → playback
     │
     ▼
  BUILD THE UNIVERSE
     │
     ▼
  EXPLORE + LISTEN
```

---
