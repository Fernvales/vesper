const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

export type LastFmSimilarTrack = {
  name: string;
  artist: string;
  mbid: string | null;
  match: number;
  url: string | null;
  artworkUrl: string | null;
  album: string | null;
};

export type LastFmTag = {
  name: string;
  count: number;
};

type LastFmImage = {
  "#text"?: string;
  size?: string;
};

type LastFmResponse = {
  error?: number;
  message?: string;
  similartracks?: {
    track?: Array<{
      name?: string;
      mbid?: string;
      match?: number | string;
      url?: string;
      image?: LastFmImage[];
      artist?: { name?: string; mbid?: string };
      album?: { title?: string };
    }>;
  };
  toptags?: {
    tag?: Array<{
      name?: string;
      count?: number | string;
    }>;
  };
};

const cache = new Map<string, { expiresAt: number; value: unknown }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function normalizeTag(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getApiKey() {
  const key = process.env.LASTFM_API_KEY?.trim();
  if (!key) return null;
  return key;
}

async function lastFmRequest(params: Record<string, string>) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const search = new URLSearchParams({
    api_key: apiKey,
    format: "json",
    autocorrect: "1",
    ...params,
  });
  const cacheKey = search.toString();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as LastFmResponse;
  }
  if (cached) cache.delete(cacheKey);

  try {
    const response = await fetch(`${LASTFM_BASE}?${search.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = (await response.json()) as LastFmResponse;

    if (data.error) {
      console.warn("Last.fm API error:", data.error, data.message ?? "");
      return null;
    }

    cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value: data,
    });

    return data;
  } catch (error) {
    console.warn("Last.fm request failed:", error);
    return null;
  }
}

function getArtworkUrl(images: LastFmImage[] | undefined) {
  if (!images?.length) return null;

  const preferredSizes = ["extralarge", "large", "medium", "small"];

  for (const size of preferredSizes) {
    const image = images.find(
      (candidate) =>
        candidate.size === size && candidate["#text"]?.trim()
    );

    if (image?.["#text"]?.trim()) {
      return image["#text"].trim();
    }
  }

  return (
    images
      .map((image) => image["#text"]?.trim() ?? "")
      .find(Boolean) ?? null
  );
}

export async function getSimilarTracks(
  artist: string,
  track: string,
  limit = 25
) {
  const data = await lastFmRequest({
    method: "track.getSimilar",
    artist,
    track,
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });

  const tracks = data?.similartracks?.track ?? [];

  return tracks
    .map((track) => {
      const match = Number(track.match ?? 0);
      const normalizedMatch = match > 1 ? match / 100 : match;

      return {
        name: track.name?.trim() ?? "",
        artist: track.artist?.name?.trim() ?? "",
        mbid: track.mbid?.trim() || null,
        match: Math.max(0, Math.min(1, normalizedMatch)),
        url: track.url?.trim() || null,
        artworkUrl: getArtworkUrl(track.image),
        album: track.album?.title?.trim() || null,
      } satisfies LastFmSimilarTrack;
    })
    .filter((track) => track.name && track.artist);
}

const NON_MUSICAL_TAGS = new Set([
  "seen live",
  "favorites",
  "favorite",
  "favourite",
  "favourites",
  "love",
  "loved",
  "awesome",
  "amazing",
  "good",
  "great",
  "beautiful",
  "albums i own",
  "owned",
  "my favorites",
  "my favourite",
  "spotify",
  "youtube",
]);

function isUsefulMusicTag(name: string) {
  const normalized = normalizeTag(name);
  if (!normalized || NON_MUSICAL_TAGS.has(normalized)) return false;
  if (/^\d{2}s$/.test(normalized)) return false;
  return true;
}

export async function getTopTags(
  artist: string,
  track: string,
  limit = 12
) {
  const data = await lastFmRequest({
    method: "track.getTopTags",
    artist,
    track,
  });

  const tags = data?.toptags?.tag ?? [];

  return tags
    .map((tag) => ({
      name: tag.name?.trim() ?? "",
      count: Number(tag.count ?? 0),
    }))
    .filter((tag) => tag.name && isUsefulMusicTag(tag.name))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function normalizedLastFmTagSet(tags: LastFmTag[]) {
  return new Set(
    tags.map((tag) => normalizeTag(tag.name)).filter(Boolean)
  );
}

export function sharedLastFmTags(
  first: LastFmTag[],
  second: LastFmTag[]
) {
  const secondSet = normalizedLastFmTagSet(second);

  return first
    .filter((tag) => secondSet.has(normalizeTag(tag.name)))
    .map((tag) => tag.name)
    .slice(0, 4);
}

export function tagMatchesGenre(tag: string, genre: string) {
  return normalizeTag(tag) === normalizeTag(genre);
}
