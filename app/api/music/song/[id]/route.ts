import { NextRequest, NextResponse } from "next/server";
import {
  getSimilarTracks,
  getTopTags,
} from "../../../../lib/lastfm";

type SimilarSong = {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  genres: string[];
  score: number;
  reason: string;
  previewUrl: string | null;
  artworkUrl: string | null;
  album: string | null;
  provider: "lastfm";
  lastFmMatch: number;
};

type UniverseNode = {
  type: "song";
  id: string;
  label: string;
  artist: string;
  genres: string[];
  previewUrl: null;
  artworkUrl: string | null;
  album: string | null;
  provider: "lastfm";
  lastFmMatch?: number | null;
};

type UniverseEdge = {
  source: string;
  target: string;
  relationship: string;
};

type UniverseResponse = {
  source: "lastfm";
  sourceId: null;
  externalId: string;
  matched: boolean;
  requested: {
    title: string;
    artist: string;
    album: string | null;
    artwork: string | null;
  };
  song: {
    id: string;
    title: string;
    artist: string;
    durationMs: null;
    disambiguation: null;
  };
  genres: string[];
  releases: [];
  releaseGroups: [];
  relatedArtists: [];
  similarSongs: SimilarSong[];
  graph: {
    center: {
      type: "song";
      id: string;
    };
    nodes: UniverseNode[];
    edges: UniverseEdge[];
  };
  resolver: {
    discovery: "lastfm";
    playback: "on-demand";
  };
};

type CachedUniverse = {
  expiresAt: number;
  data: UniverseResponse;
};

const CACHE_TTL_MS = 15 * 60 * 1000;

const universeCache = new Map<
  string,
  CachedUniverse
>();

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(feat\.?|ft\.?)\b.*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function musicKey(
  title: string,
  artist: string
) {
  return `${normalizeText(title)}::${normalizeText(
    artist
  )}`;
}

function songId(
  title: string,
  artist: string
) {
  return `lf:${musicKey(title, artist)}`;
}

function uniqueStrings(
  values: unknown[]
) {
  return Array.from(
    new Set(
      values
        .filter(
          (value): value is string =>
            typeof value === "string"
        )
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function buildUniverse(
  requestedId: string,
  title: string,
  artist: string,
  album: string | null,
  artwork: string | null,
  similarTracks: Awaited<
    ReturnType<typeof getSimilarTracks>
  >,
  topTags: Awaited<
    ReturnType<typeof getTopTags>
  >
): UniverseResponse {
  const centerId = songId(title, artist);

  const centerGenres = uniqueStrings(
    topTags.map((tag) => tag?.name)
  ).slice(0, 4);

  const seen = new Set<string>([
    musicKey(title, artist),
  ]);

  const selected: SimilarSong[] = [];

  for (const track of similarTracks) {
    if (!track) {
      continue;
    }

    const trackTitle =
      typeof track.name === "string"
        ? track.name.trim()
        : "";

    const trackArtist =
      typeof track.artist === "string"
        ? track.artist.trim()
        : "";

    if (!trackTitle || !trackArtist) {
      continue;
    }

    const key = musicKey(
      trackTitle,
      trackArtist
    );

    if (seen.has(key)) {
      continue;
    }

    if (
      normalizeText(trackArtist) ===
      normalizeText(artist)
    ) {
      continue;
    }

    const match =
      typeof track.match === "number" &&
      Number.isFinite(track.match)
        ? Math.max(
            0,
            Math.min(1, track.match)
          )
        : 0;

    if (match < 0.15) {
      continue;
    }

    seen.add(key);

    const artworkUrl =
      typeof track.artworkUrl === "string" &&
      track.artworkUrl.trim()
        ? track.artworkUrl.trim()
        : null;

    const trackAlbum =
      typeof track.album === "string" &&
      track.album.trim()
        ? track.album.trim()
        : null;

    const reason =
      centerGenres.length > 0
        ? `Last.fm similarity · ${Math.round(
            match * 100
          )}% · ${centerGenres
            .slice(0, 2)
            .join(" · ")}`
        : `Last.fm similarity · ${Math.round(
            match * 100
          )}%`;

    selected.push({
      id: songId(
        trackTitle,
        trackArtist
      ),
      title: trackTitle,
      artist: trackArtist,
      artistId:
        typeof track.mbid === "string"
          ? track.mbid
          : null,
      genres: centerGenres,
      score: match,
      reason,
      previewUrl: null,
      artworkUrl,
      album: trackAlbum,
      provider: "lastfm",
      lastFmMatch: match,
    });

    if (selected.length >= 8) {
      break;
    }
  }

  const nodes: UniverseNode[] = [
    {
      type: "song",
      id: centerId,
      label: title,
      artist,
      genres: centerGenres,
      previewUrl: null,
      artworkUrl: artwork,
      album,
      provider: "lastfm",
    },

    ...selected.map(
      (song): UniverseNode => ({
        type: "song",
        id: song.id,
        label: song.title,
        artist: song.artist,
        genres: song.genres,
        previewUrl: null,
        artworkUrl: song.artworkUrl,
        album: song.album,
        provider: "lastfm",
        lastFmMatch: song.lastFmMatch,
      })
    ),
  ];

  const edges: UniverseEdge[] =
    selected.map((song) => ({
      source: centerId,
      target: song.id,
      relationship: song.reason,
    }));

  return {
    source: "lastfm",
    sourceId: null,
    externalId: requestedId,
    matched: selected.length > 0,

    requested: {
      title,
      artist,
      album,
      artwork,
    },

    song: {
      id: centerId,
      title,
      artist,
      durationMs: null,
      disambiguation: null,
    },

    genres: centerGenres,

    releases: [],
    releaseGroups: [],
    relatedArtists: [],

    similarSongs: selected,

    graph: {
      center: {
        type: "song",
        id: centerId,
      },
      nodes,
      edges,
    },

    resolver: {
      discovery: "lastfm",
      playback: "on-demand",
    },
  };
}

function buildQuietUniverse(
  requestedId: string,
  title: string,
  artist: string,
  album: string | null,
  artwork: string | null
): UniverseResponse {
  const centerId = songId(
    title,
    artist
  );

  return {
    source: "lastfm",
    sourceId: null,
    externalId: requestedId,
    matched: false,

    requested: {
      title,
      artist,
      album,
      artwork,
    },

    song: {
      id: centerId,
      title,
      artist,
      durationMs: null,
      disambiguation: null,
    },

    genres: [],

    releases: [],
    releaseGroups: [],
    relatedArtists: [],

    similarSongs: [],

    graph: {
      center: {
        type: "song",
        id: centerId,
      },

      nodes: [
        {
          type: "song",
          id: centerId,
          label: title,
          artist,
          genres: [],
          previewUrl: null,
          artworkUrl: artwork,
          album,
          provider: "lastfm",
        },
      ],

      edges: [],
    },

    resolver: {
      discovery: "lastfm",
      playback: "on-demand",
    },
  };
}

export async function GET(
  request: NextRequest
) {
  const { searchParams, pathname } =
    new URL(request.url);

  const requestedId =
    pathname
      .split("/")
      .filter(Boolean)
      .pop() ?? "";

  const title =
    searchParams
      .get("title")
      ?.trim() ?? "";

  const artist =
    searchParams
      .get("artist")
      ?.trim() ?? "";

  const album =
    searchParams
      .get("album")
      ?.trim() || null;

  const artwork =
    searchParams
      .get("artwork")
      ?.trim() || null;

  if (
    !requestedId ||
    !title ||
    !artist
  ) {
    return NextResponse.json(
      {
        error:
          "A song id, title, and artist are required.",
      },
      { status: 400 }
    );
  }

  const cacheKey = musicKey(
    title,
    artist
  );

  const cached =
    universeCache.get(cacheKey);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return NextResponse.json(
      cached.data,
      {
        headers: {
          "Cache-Control":
            "public, max-age=900, stale-while-revalidate=3600",
        },
      }
    );
  }

  if (cached) {
    universeCache.delete(cacheKey);
  }

  /*
   * Start with a valid quiet universe.
   *
   * This is intentional:
   * Last.fm is a discovery enhancement, not a requirement
   * for the song page itself to work.
   */
  let data = buildQuietUniverse(
    requestedId,
    title,
    artist,
    album,
    artwork
  );

  try {
    /*
     * IMPORTANT:
     *
     * There are NO Apple/iTunes calls in this route.
     * Discovery is Last.fm-only.
     * Playback is resolved elsewhere/on demand.
     */
    const [
      similarTracksResult,
      topTagsResult,
    ] = await Promise.allSettled([
      getSimilarTracks(
        artist,
        title,
        20
      ),

      getTopTags(
        artist,
        title,
        8
      ),
    ]);

    const similarTracks =
      similarTracksResult.status ===
      "fulfilled"
        ? Array.isArray(
            similarTracksResult.value
          )
          ? similarTracksResult.value
          : []
        : [];

    const topTags =
      topTagsResult.status ===
      "fulfilled"
        ? Array.isArray(
            topTagsResult.value
          )
          ? topTagsResult.value
          : []
        : [];

    data = buildUniverse(
      requestedId,
      title,
      artist,
      album,
      artwork,
      similarTracks,
      topTags
    );

    universeCache.set(
      cacheKey,
      {
        expiresAt:
          Date.now() +
          CACHE_TTL_MS,
        data,
      }
    );

    return NextResponse.json(
      data,
      {
        headers: {
          "Cache-Control":
            "public, max-age=900, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    /*
     * Last.fm must NEVER make the song page fail.
     *
     * Log the actual server-side problem for development,
     * but return a valid quiet universe to the client.
     */
    console.error(
      "Vesper Last.fm universe discovery failed:",
      error
    );

    universeCache.set(
      cacheKey,
      {
        expiresAt:
          Date.now() +
          CACHE_TTL_MS,
        data,
      }
    );

    return NextResponse.json(
      data,
      {
        headers: {
          "Cache-Control":
            "public, max-age=900, stale-while-revalidate=3600",
        },
      }
    );
  }
}