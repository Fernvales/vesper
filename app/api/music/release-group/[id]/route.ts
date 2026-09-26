import { NextResponse } from "next/server";

const MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2";

const headers = {
  Accept: "application/json",
  "User-Agent": "Vesper/0.1.0 (music exploration project)",
};

type Release = {
  id: string;
  title: string;
  date?: string;
  status?: string;
  country?: string;
};

type ReleaseGroup = {
  id: string;
  title: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  releases?: Release[];
};

type Recording = {
  id: string;
  title: string;
  length?: number | null;
};

type Track = {
  id: string;
  number: string;
  position: number;
  title: string;
  duration: string | null;
};

type ReleaseDetails = {
  id: string;
  title: string;
  date?: string;
  status?: string;
  country?: string;
  media?: {
    position: number;
    format?: string;
    "track-list"?: {
      position: number;
      number?: string;
      recording?: Recording;
    }[];
  }[];
};

function formatDuration(
  milliseconds?: number | null
) {
  if (!milliseconds) return null;

  const totalSeconds =
    Math.floor(milliseconds / 1000);

  const minutes =
    Math.floor(totalSeconds / 60);

  const seconds =
    totalSeconds % 60;

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function releaseSortValue(
  release: Release
) {
  const official =
    release.status?.toLowerCase() ===
    "official"
      ? "0"
      : "1";

  const date =
    release.date ?? "9999-99-99";

  return `${official}-${date}-${release.id}`;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await context.params;

  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
    return NextResponse.json(
      {
        error: "Invalid release group ID.",
      },
      { status: 400 }
    );
  }

  try {
    const groupResponse = await fetch(
      `${MUSICBRAINZ_URL}/release-group/${id}?inc=releases&fmt=json`,
      {
        headers,
        next: { revalidate: 1800 },
      }
    );

    if (!groupResponse.ok) {
      return NextResponse.json(
        {
          error:
            "Release group lookup failed.",
          status: groupResponse.status,
        },
        { status: 502 }
      );
    }

    const group =
      (await groupResponse.json()) as ReleaseGroup;

    const releases =
      group.releases ?? [];

    if (!releases.length) {
      return NextResponse.json({
        album: {
          id: group.id,
          title: group.title,
          year:
            group["first-release-date"]?.slice(
              0,
              4
            ) ?? null,
          type:
            group["primary-type"] ?? "Album",
        },
        release: null,
        songs: [],
      });
    }

    const canonicalRelease =
      [...releases].sort((a, b) =>
        releaseSortValue(a).localeCompare(
          releaseSortValue(b)
        )
      )[0];

    const releaseResponse = await fetch(
      `${MUSICBRAINZ_URL}/release/${canonicalRelease.id}?inc=recordings&fmt=json`,
      {
        headers,
        next: { revalidate: 1800 },
      }
    );

    if (!releaseResponse.ok) {
      return NextResponse.json(
        {
          error:
            "Tracklist lookup failed.",
          status:
            releaseResponse.status,
        },
        { status: 502 }
      );
    }

    const release =
      (await releaseResponse.json()) as ReleaseDetails;

    const songs: Track[] = [];

    for (
      const medium of release.media ?? []
    ) {
      for (
        const track of medium["track-list"] ?? []
      ) {
        const recording = track.recording;

        if (!recording) continue;

        songs.push({
          id: recording.id,
          number:
            track.number ??
            String(track.position),
          position: songs.length + 1,
          title: recording.title,
          duration:
            formatDuration(recording.length),
        });
      }
    }

    const uniqueSongs = songs.filter(
      (song, index, array) =>
        array.findIndex(
          (other) =>
            other.id === song.id
        ) === index
    );

    return NextResponse.json({
      album: {
        id: group.id,
        title: group.title,
        year:
          group["first-release-date"]?.slice(
            0,
            4
          ) ?? null,
        type:
          group["primary-type"] ?? "Album",
      },

      release: {
        id: release.id,
        title: release.title,
        date: release.date ?? null,
        status: release.status ?? null,
        country: release.country ?? null,
      },

      songs: uniqueSongs,
    });
  } catch (error) {
    console.error(
      "Release group error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to retrieve this release.",
      },
      { status: 500 }
    );
  }
}