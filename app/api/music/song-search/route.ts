import { NextRequest, NextResponse } from "next/server";

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";
const DEEZER_SEARCH_URL = "https://api.deezer.com/search/track";
const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

const CACHE_TTL_MS = 10 * 60 * 1000;
const APPLE_COOLDOWN_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 8 * 1000;

type ITunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
};

type ITunesResponse = {
  results?: ITunesResult[];
};

type DeezerArtist = {
  id?: number;
  name?: string;
};

type DeezerAlbum = {
  id?: number;
  title?: string;
  cover?: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
};

type DeezerTrack = {
  id?: number;
  title?: string;
  duration?: number;
  preview?: string;
  link?: string;
  artist?: DeezerArtist;
  album?: DeezerAlbum;
};

type DeezerResponse = {
  data?: DeezerTrack[];
};

type LastFmTrack = {
  name?: string;
  artist?: string;
  url?: string;
  mbid?: string;
  image?: Array<{ "#text"?: string; size?: string }>;
};

type LastFmResponse = {
  results?: {
    trackmatches?: {
      track?: LastFmTrack[];
    };
  };
};

type PlaybackProvider = "itunes" | "deezer";

type SongResult = {
  id: string;
  title: string;
  artistName: string;
  albumName: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
  playback: {
    provider: PlaybackProvider;
    url: string | null;
    externalId?: string | null;
    sourceUrl?: string | null;
  };
  sources: PlaybackProvider[];
};

type CachedSongs = {
  expiresAt: number;
  songs: SongResult[];
  discoveryMode: boolean;
};

const searchCache = new Map<string, CachedSongs>();
let appleCooldownUntil = 0;

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*(official|audio|video|visualizer|lyrics?)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(official|audio|video|visualizer|lyrics?)[^\]]*\]/gi, "")
    .replace(/\b(feat\.?|ft\.?)\b.*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function dedupeSongs(songs: SongResult[]) {
  const seen = new Set<string>();

  return songs.filter((song) => {
    const key = `${normalizeText(song.title)}::${normalizeText(song.artistName)}`;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function searchApple(query: string): Promise<SongResult[]> {
  if (Date.now() < appleCooldownUntil) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      term: query,
      country: "US",
      media: "music",
      entity: "song",
      limit: "12",
      lang: "en_us",
    });

    const response = await fetchWithTimeout(
      `${ITUNES_SEARCH_URL}?${params.toString()}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      appleCooldownUntil = Date.now() + APPLE_COOLDOWN_MS;
      return [];
    }

    const data = (await response.json()) as ITunesResponse;

    return dedupeSongs(
      (Array.isArray(data.results) ? data.results : [])
        .filter(
          (result) =>
            typeof result.trackId === "number" &&
            typeof result.trackName === "string" &&
            typeof result.artistName === "string" &&
            typeof result.previewUrl === "string" &&
            result.previewUrl.length > 0
        )
        .map((result) => ({
          id: `song:itunes:${String(result.trackId)}`,
          title: result.trackName as string,
          artistName: result.artistName as string,
          albumName:
            typeof result.collectionName === "string"
              ? result.collectionName
              : null,
          artworkUrl:
            typeof result.artworkUrl100 === "string"
              ? result.artworkUrl100.replace("100x100", "600x600")
              : null,
          previewUrl: result.previewUrl as string,
          durationMs:
            typeof result.trackTimeMillis === "number"
              ? result.trackTimeMillis
              : null,
          playback: {
            provider: "itunes" as const,
            url: result.previewUrl as string,
            externalId: String(result.trackId),
            sourceUrl: null,
          },
          sources: ["itunes" as const],
        }))
    );
  } catch {
    appleCooldownUntil = Date.now() + APPLE_COOLDOWN_MS;
    return [];
  }
}

async function searchDeezer(query: string): Promise<SongResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: "25",
    });

    const response = await fetchWithTimeout(
      `${DEEZER_SEARCH_URL}?${params.toString()}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as DeezerResponse;
    const tracks = Array.isArray(data.data) ? data.data : [];

    return dedupeSongs(
      tracks
        .filter(
          (track) =>
            typeof track.id === "number" &&
            typeof track.title === "string" &&
            track.title.trim().length > 0 &&
            typeof track.artist?.name === "string" &&
            track.artist.name.trim().length > 0 &&
            typeof track.preview === "string" &&
            track.preview.length > 0
        )
        .map((track) => {
          const artwork =
            track.album?.cover_xl ??
            track.album?.cover_big ??
            track.album?.cover_medium ??
            track.album?.cover ??
            null;

          return {
            id: `song:deezer:${String(track.id)}`,
            title: track.title as string,
            artistName: track.artist?.name as string,
            albumName:
              typeof track.album?.title === "string"
                ? track.album.title
                : null,
            artworkUrl: artwork,
            previewUrl: track.preview as string,
            durationMs:
              typeof track.duration === "number"
                ? track.duration * 1000
                : null,
            playback: {
              provider: "deezer" as const,
              url: track.preview as string,
              externalId: String(track.id),
              sourceUrl:
                typeof track.link === "string" ? track.link : null,
            },
            sources: ["deezer" as const],
          };
        })
    );
  } catch {
    return [];
  }
}

async function searchLastFm(query: string): Promise<SongResult[]> {
  const apiKey = process.env.LASTFM_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      method: "track.search",
      track: query,
      api_key: apiKey,
      format: "json",
      limit: "12",
      autocorrect: "1",
    });

    const response = await fetchWithTimeout(
      `${LASTFM_API_URL}?${params.toString()}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as LastFmResponse;
    const tracks = Array.isArray(data.results?.trackmatches?.track)
      ? data.results.trackmatches.track
      : [];

    /*
     * Last.fm is intentionally discovery-only here.
     * It does not become a fake audio provider.
     */
    return dedupeSongs(
      tracks
        .filter(
          (track) =>
            typeof track.name === "string" &&
            track.name.trim().length > 0 &&
            typeof track.artist === "string" &&
            track.artist.trim().length > 0
        )
        .map((track) => {
          const image = Array.isArray(track.image)
            ? [...track.image]
                .reverse()
                .find(
                  (item) =>
                    typeof item?.["#text"] === "string" &&
                    item["#text"].length > 0
                )?.["#text"] ?? null
            : null;

          const title = track.name as string;
          const artist = track.artist as string;
          const externalId =
            track.mbid?.trim() ||
            `${normalizeText(artist)}:${normalizeText(title)}`;

          return {
            id: `song:lastfm:${externalId}`,
            title,
            artistName: artist,
            albumName: null,
            artworkUrl: image,
            previewUrl: null,
            durationMs: null,
            playback: {
              provider: "deezer" as const,
              url: null,
              externalId: null,
              sourceUrl: track.url ?? null,
            },
            sources: [],
          };
        })
    );
  } catch {
    return [];
  }
}

function rankMatch(
  candidate: SongResult,
  query: string
) {
  const candidateTitle = normalizeText(candidate.title);
  const candidateArtist = normalizeText(candidate.artistName);
  const normalizedQuery = normalizeText(query);

  let score = 0;

  if (normalizedQuery === `${candidateTitle} ${candidateArtist}`) {
    score += 100;
  }

  if (normalizedQuery.includes(candidateTitle)) {
    score += 30;
  }

  if (normalizedQuery.includes(candidateArtist)) {
    score += 30;
  }

  if (candidate.previewUrl) {
    score += 20;
  }

  return score;
}

function mergePlayableSongs(
  appleSongs: SongResult[],
  deezerSongs: SongResult[]
) {
  const merged: SongResult[] = [];
  const byKey = new Map<string, SongResult>();

  /*
   * Deezer is the fallback provider, but when both catalogs contain the
   * same recording we keep Apple's result first so existing Vesper behavior
   * remains unchanged while Deezer fills Apple gaps.
   */
  for (const song of [...appleSongs, ...deezerSongs]) {
    const key = `${normalizeText(song.title)}::${normalizeText(song.artistName)}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...song,
        sources: [...song.sources],
      });
      merged.push(byKey.get(key) as SongResult);
      continue;
    }

    const existingIsApple = existing.playback.provider === "itunes";

    if (
      !existing.previewUrl &&
      song.previewUrl
    ) {
      existing.previewUrl = song.previewUrl;
    }

    if (!existing.artworkUrl && song.artworkUrl) {
      existing.artworkUrl = song.artworkUrl;
    }

    if (!existing.albumName && song.albumName) {
      existing.albumName = song.albumName;
    }

    for (const source of song.sources) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
    }

    if (!existingIsApple && song.playback.url) {
      existing.playback = song.playback;
    }
  }

  return merged;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      {
        songs: [],
        results: [],
        error: "Enter a song, artist, or album.",
      },
      { status: 400 }
    );
  }

  if (query.length > 100) {
    return NextResponse.json(
      {
        songs: [],
        results: [],
        error: "Search query is too long.",
      },
      { status: 400 }
    );
  }

  const cacheKey = normalizeText(query);
  const cached = searchCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      songs: cached.songs,
      results: cached.songs,
      discoveryMode: cached.discoveryMode,
      unavailable: false,
      cached: true,
      providers: {
        apple: cached.songs.some((song) =>
          song.sources.includes("itunes")
        ),
        deezer: cached.songs.some((song) =>
          song.sources.includes("deezer")
        ),
      },
    });
  }

  if (cached) {
    searchCache.delete(cacheKey);
  }

  /*
   * Apple and Deezer are independent providers.
   * One failing must never prevent the other from responding.
   */
  const [appleResult, deezerResult] = await Promise.allSettled([
    searchApple(query),
    searchDeezer(query),
  ]);

  const appleSongs =
    appleResult.status === "fulfilled" ? appleResult.value : [];

  const deezerSongs =
    deezerResult.status === "fulfilled" ? deezerResult.value : [];

  const playableSongs = mergePlayableSongs(
    appleSongs,
    deezerSongs
  );

  if (playableSongs.length > 0) {
    const rankedSongs = [...playableSongs].sort(
      (a, b) => rankMatch(b, query) - rankMatch(a, query)
    );

    searchCache.set(cacheKey, {
      songs: rankedSongs,
      discoveryMode: false,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({
      songs: rankedSongs,
      results: rankedSongs,
      discoveryMode: false,
      unavailable: false,
      cached: false,
      providers: {
        apple: appleSongs.length > 0,
        deezer: deezerSongs.length > 0,
      },
    });
  }

  /*
   * Only after both playable catalogs fail do we fall back to Last.fm.
   * These results are discovery metadata and intentionally have no audio URL.
   */
  const discoverySongs = await searchLastFm(query);

  if (discoverySongs.length > 0) {
    searchCache.set(cacheKey, {
      songs: discoverySongs,
      discoveryMode: true,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({
      songs: discoverySongs,
      results: discoverySongs,
      discoveryMode: true,
      unavailable: false,
      cached: false,
      providers: {
        apple: false,
        deezer: false,
      },
      notice:
        "No playable catalog result was available right now. Vesper is showing discovery results instead.",
    });
  }

  return NextResponse.json({
    songs: [],
    results: [],
    discoveryMode: false,
    unavailable: true,
    cached: false,
    providers: {
      apple: false,
      deezer: false,
    },
    error:
      "No playable music catalog result was available for this signal right now.",
  });
}
