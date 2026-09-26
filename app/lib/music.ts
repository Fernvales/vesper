export type MusicProviderName = "itunes" | "soundcloud" | "local";

export type PlaybackSource = {
  provider: MusicProviderName;
  url: string | null;
  externalId?: string | null;
  sourceUrl?: string | null;
};

export type VesperSearchSong = {
  id: string;
  title: string;
  artistName: string;
  albumName: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
  playback: PlaybackSource;
  sources: MusicProviderName[];
};

export function normalizeMusicText(value: string) {
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

export function musicMatchKey(title: string, artist: string) {
  return `${normalizeMusicText(title)}::${normalizeMusicText(artist)}`;
}

export function durationsMatch(
  first: number | null | undefined,
  second: number | null | undefined
) {
  if (!first || !second) return true;
  return Math.abs(first - second) <= 5000;
}
