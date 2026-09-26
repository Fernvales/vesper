import { NextResponse } from "next/server";

const MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2";

const headers = {
  Accept: "application/json",
  "User-Agent": "Vesper/0.1.0 (music exploration project)",
};

type Alias = {
  name: string;
  type?: string | null;
  locale?: string | null;
  primary?: boolean | null;
};

type ArtistRelation = {
  type?: string;
  direction?: string;
  artist?: { id: string; name: string; type?: string };
};

type MusicBrainzArtist = {
  id: string;
  name: string;
  type?: string;
  country?: string;
  area?: { name?: string };
  "begin-area"?: { name?: string };
  disambiguation?: string;
  genres?: { name: string; count?: number }[];
  aliases?: Alias[];
  "life-span"?: { begin?: string | null; end?: string | null; ended?: boolean };
  relations?: ArtistRelation[];
};

type MusicBrainzRelease = {
  id: string;
  title: string;
  date?: string;
  status?: string;
  "release-group"?: {
    id: string;
    title?: string;
    "first-release-date"?: string;
    "primary-type"?: string;
    "secondary-type-list"?: string[];
  };
  media?: {
    position?: number;
    title?: string;
    tracks?: {
      id: string;
      position?: number;
      number?: string;
      title?: string;
      length?: number | null;
      recording?: { id: string; title: string; length?: number | null };
    }[];
  }[];
};

const EXCLUDED_SECONDARY_TYPES = new Set([
  "Compilation",
  "Demo",
  "DJ-mix",
  "Field recording",
  "Interview",
  "Live",
  "Mixtape/Street",
  "Remix",
  "Soundtrack",
  "Spokenword",
]);

const ZODIAC = [
  { sign: "Capricorn", glyph: "♑︎", start: [12, 22], end: [1, 19] },
  { sign: "Aquarius", glyph: "♒︎", start: [1, 20], end: [2, 18] },
  { sign: "Pisces", glyph: "♓︎", start: [2, 19], end: [3, 20] },
  { sign: "Aries", glyph: "♈︎", start: [3, 21], end: [4, 19] },
  { sign: "Taurus", glyph: "♉︎", start: [4, 20], end: [5, 20] },
  { sign: "Gemini", glyph: "♊︎", start: [5, 21], end: [6, 20] },
  { sign: "Cancer", glyph: "♋︎", start: [6, 21], end: [7, 22] },
  { sign: "Leo", glyph: "♌︎", start: [7, 23], end: [8, 22] },
  { sign: "Virgo", glyph: "♍︎", start: [8, 23], end: [9, 22] },
  { sign: "Libra", glyph: "♎︎", start: [9, 23], end: [10, 22] },
  { sign: "Scorpio", glyph: "♏︎", start: [10, 23], end: [11, 21] },
  { sign: "Sagittarius", glyph: "♐︎", start: [11, 22], end: [12, 21] },
];

function getZodiac(date: string | null) {
  if (!date) return null;
  const [monthText, dayText] = date.split("-").slice(1, 3);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!month || !day) return null;

  for (const zodiac of ZODIAC) {
    const [startMonth, startDay] = zodiac.start;
    const [endMonth, endDay] = zodiac.end;
    const afterStart = month > startMonth || (month === startMonth && day >= startDay);
    const beforeEnd = month < endMonth || (month === endMonth && day <= endDay);
    if (startMonth > endMonth ? afterStart || beforeEnd : afterStart && beforeEnd) {
      return { sign: zodiac.sign, glyph: zodiac.glyph };
    }
  }
  return null;
}

function formatDuration(milliseconds?: number | null) {
  if (!milliseconds) return null;
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function relationLabel(type: string | undefined) {
  if (!type) return "RELATED ARTIST";
  const value = type.trim().toLowerCase();
  if (value === "member of band") return "MEMBER OF BAND";
  if (value === "subgroup") return "SUBGROUP";
  if (value === "musical relationship") return "MUSICAL RELATIONSHIP";
  if (value === "supporting musician") return "SUPPORTING MUSICIAN";
  if (value === "vocal supporting musician") return "VOCAL SUPPORT";
  return type.toUpperCase();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid artist ID." }, { status: 400 });
  }

  try {
    const artistResponse = await fetch(
      `${MUSICBRAINZ_URL}/artist/${id}?inc=aliases+genres+artist-rels&fmt=json`,
      { headers, next: { revalidate: 300 } }
    );
    if (!artistResponse.ok) {
      return NextResponse.json({ error: "Artist lookup failed.", status: artistResponse.status }, { status: 502 });
    }

    const artist = (await artistResponse.json()) as MusicBrainzArtist;

    // Browse actual official releases instead of asking for one release per release-group.
    // This gives Vesper real release rows and their media/recordings in the same response.
    const releaseParams = new URLSearchParams({
      artist: id,
      type: "album|ep",
      status: "official",
      limit: "100",
      inc: "release-groups+media+recordings",
      fmt: "json",
    });

    const releaseResponse = await fetch(
      `${MUSICBRAINZ_URL}/release?${releaseParams.toString()}`,
      { headers, cache: "no-store" }
    );

    let releases: MusicBrainzRelease[] = [];
    let officialReleaseCount = 0;

    if (releaseResponse.ok) {
      const data = await releaseResponse.json();
      releases = (data.releases ?? []) as MusicBrainzRelease[];
      officialReleaseCount = typeof data.count === "number" ? data.count : releases.length;
    }

    const validReleases = releases.filter((release) => {
      const group = release["release-group"];
      const primary = group?.["primary-type"];
      const secondary = group?.["secondary-type-list"] ?? [];
      return (
        (primary === "Album" || primary === "EP") &&
        !secondary.some((type) => EXCLUDED_SECONDARY_TYPES.has(type))
      );
    });

    officialReleaseCount = validReleases.length;

    const albumMap = new Map<string, {
      id: string;
      title: string;
      year: string | null;
      type: string;
      secondaryTypes: string[];
      trackCount: number;
    }>();

    const songsById = new Map<string, {
      id: string;
      title: string;
      duration: string | null;
      album: string | null;
      albumId: string | null;
      position: number | null;
      number: string | null;
    }>();

    for (const release of validReleases) {
      const group = release["release-group"];
      if (!group?.id) continue;

      if (!albumMap.has(group.id)) {
        albumMap.set(group.id, {
          id: group.id,
          title: group.title ?? release.title,
          year: (group["first-release-date"] ?? release.date)?.slice(0, 4) ?? null,
          type: group["primary-type"] ?? "Release",
          secondaryTypes: group["secondary-type-list"] ?? [],
          trackCount: 0,
        });
      }

      const album = albumMap.get(group.id)!;
      const tracks = (release.media ?? [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .flatMap((medium) => medium.tracks ?? [])
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      album.trackCount = Math.max(album.trackCount, tracks.length);

      for (const track of tracks) {
        const recording = track.recording;
        if (!recording?.id || songsById.has(recording.id)) continue;
        songsById.set(recording.id, {
          id: recording.id,
          title: recording.title || track.title || "Untitled",
          duration: formatDuration(recording.length ?? track.length ?? null),
          album: album.title,
          albumId: album.id,
          position: track.position ?? null,
          number: track.number ?? (track.position ? String(track.position).padStart(2, "0") : null),
        });
      }
    }

    const albums = [...albumMap.values()]
      .sort((a, b) => (a.year ?? "9999").localeCompare(b.year ?? "9999") || a.title.localeCompare(b.title))
      .slice(0, 36);

    const aliases = (artist.aliases ?? [])
      .filter((alias) => alias.name && alias.name !== artist.name)
      .map((alias) => ({
        name: alias.name,
        type: alias.type ?? null,
        locale: alias.locale ?? null,
        primary: alias.primary ?? false,
      }))
      .filter((alias, index, array) => array.findIndex((other) => normalizeName(other.name) === normalizeName(alias.name)) === index);

    const artistNames = aliases.filter((alias) => {
      const type = alias.type?.toLowerCase() ?? "";
      return !type.includes("legal") && !type.includes("search");
    });
    const legalNames = aliases.filter((alias) => alias.type?.toLowerCase().includes("legal"));
    const searchHints = aliases.filter((alias) => alias.type?.toLowerCase().includes("search"));
    const knownArtistNames = new Set([artist.name, ...aliases.map((alias) => alias.name)].map(normalizeName));

    const relatedArtists = (artist.relations ?? [])
      .filter((relation) => {
        const type = relation.type?.toLowerCase() ?? "";
        return relation.artist && relation.artist.id !== artist.id && !type.includes("is person") && !type.includes("personal relationship") && !type.includes("teacher");
      })
      .map((relation) => ({
        id: relation.artist!.id,
        name: relation.artist!.name,
        type: relation.artist!.type ?? null,
        relationship: relationLabel(relation.type),
        direction: relation.direction ?? null,
      }))
      .filter((item) => !knownArtistNames.has(normalizeName(item.name)))
      .filter((item, index, array) => array.findIndex((other) => other.id === item.id) === index)
      .slice(0, 24);

    const beginDate = artist["life-span"]?.begin ?? null;
    const isPerson = artist.type?.toLowerCase() === "person";
    const genres = [...(artist.genres ?? [])]
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .map((genre) => genre.name)
      .filter((genre, index, array) => array.findIndex((item) => normalizeName(item) === normalizeName(genre)) === index)
      .slice(0, 12);

    return NextResponse.json({
      artist: {
        id: artist.id,
        name: artist.name,
        type: artist.type ?? null,
        country: artist.country ?? null,
        area: artist.area?.name ?? null,
        beginArea: artist["begin-area"]?.name ?? null,
        disambiguation: artist.disambiguation ?? null,
        aliases,
        aliasGroups: { artistNames, legalNames, searchHints },
        lifeSpan: { begin: beginDate, end: artist["life-span"]?.end ?? null, ended: artist["life-span"]?.ended ?? false },
        zodiac: isPerson ? getZodiac(beginDate) : null,
      },
      genres,
      albums,
      songs: [...songsById.values()],
      releaseCounts: {
        albums: albums.filter((album) => album.type === "Album").length,
        eps: albums.filter((album) => album.type === "EP").length,
        officialReleases: officialReleaseCount,
      },
      relatedArtists,
    });
  } catch (error) {
    console.error("Artist universe error:", error);
    return NextResponse.json({ error: "Unable to retrieve this artist from the music atlas." }, { status: 500 });
  }
}
