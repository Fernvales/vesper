"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useMusic } from "./components/MusicProvider";

type SongResult = {
  id: string;
  title: string;
  artistName: string;
  albumName: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
  playback: {
    provider: "soundcloud" | "itunes" | "local";
    url: string | null;
    externalId?: string | null;
    sourceUrl?: string | null;
  };
  sources: Array<"soundcloud" | "itunes" | "local">;
};


const zodiacSigns = [
  "♈︎",
  "♉︎",
  "♊︎",
  "♋︎",
  "♌︎",
  "♍︎",
  "♎︎",
  "♏︎",
  "♐︎",
  "♑︎",
  "♒︎",
  "♓︎",
];

const APPLE_DIRECT_CACHE_TTL_MS = 60_000;
const APPLE_DIRECT_COOLDOWN_MS = 30_000;

const appleDirectCache = new Map<
  string,
  { songs: SongResult[]; expiresAt: number }
>();

const appleDirectInFlight = new Map<string, Promise<SongResult[]>>();
let appleDirectCooldownUntil = 0;

async function searchAppleDirect(query: string): Promise<SongResult[]> {
  const cacheKey = query.trim().toLowerCase();
  const now = Date.now();
  const cached = appleDirectCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.songs;
  }

  if (cached) {
    appleDirectCache.delete(cacheKey);
  }

  if (appleDirectCooldownUntil > now) {
    throw new Error("Apple direct search is temporarily cooling down.");
  }

  const existingRequest = appleDirectInFlight.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = new Promise<SongResult[]>((resolve, reject) => {
    const callbackName = `__vesperAppleSearch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const params = new URLSearchParams({
      term: query,
      country: "US",
      media: "music",
      entity: "song",
      limit: "12",
      lang: "en_us",
      callback: callbackName,
    });

    const script = document.createElement("script");
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeout);
      script.remove();
      try {
        delete (window as unknown as Record<string, unknown>)[callbackName];
      } catch {
        (window as unknown as Record<string, unknown>)[callbackName] = undefined;
      }
    };

    const finish = (songs: SongResult[]) => {
      if (settled) return;
      settled = true;
      cleanup();
      appleDirectCache.set(cacheKey, {
        songs,
        expiresAt: Date.now() + APPLE_DIRECT_CACHE_TTL_MS,
      });
      resolve(songs);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();

      // JSONP script failures do not expose Apple's HTTP status to the browser.
      // Treat a failed direct catalog request conservatively as a short cooldown
      // so repeated searches do not immediately hammer the Apple endpoint again.
      appleDirectCooldownUntil = Date.now() + APPLE_DIRECT_COOLDOWN_MS;
      reject(error);
    };

    const timeout = window.setTimeout(() => {
      fail(new Error("Apple direct search timed out."));
    }, 10000);

    (window as unknown as Record<string, unknown>)[callbackName] = (data: { results?: unknown[] }) => {
      const results = Array.isArray(data?.results) ? data.results : [];

      const songs = results
        .filter((result): result is Record<string, unknown> => Boolean(result) && typeof result === "object")
        .filter(
          (result) =>
            typeof result.trackId === "number" &&
            typeof result.trackName === "string" &&
            typeof result.artistName === "string"
        )
        .map((result) => ({
          id: `song:itunes:${String(result.trackId)}`,
          title: result.trackName as string,
          artistName: result.artistName as string,
          albumName: typeof result.collectionName === "string" ? result.collectionName : null,
          artworkUrl: typeof result.artworkUrl100 === "string"
            ? result.artworkUrl100.replace("100x100", "600x600")
            : null,
          previewUrl: typeof result.previewUrl === "string" && result.previewUrl.length > 0
            ? result.previewUrl
            : null,
          durationMs: typeof result.trackTimeMillis === "number" ? result.trackTimeMillis : null,
          playback: {
            provider: "itunes" as const,
            url: typeof result.previewUrl === "string" && result.previewUrl.length > 0
              ? result.previewUrl
              : null,
            externalId: String(result.trackId),
            sourceUrl: null,
          },
          sources: ["itunes" as const],
        }));

      finish(songs);
    };

    script.async = true;
    script.src = `https://itunes.apple.com/search?${params.toString()}`;
    script.onerror = () => fail(new Error("Apple direct search failed."));
    document.head.appendChild(script);
  });

  appleDirectInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    appleDirectInFlight.delete(cacheKey);
  }
}

const mottos = [
  "Every sound leaves a trace.",
  "Music has coordinates.",
  "Follow the signal.",
  "There is more between the notes.",
  "Listen past the surface.",
  "Find where the sound leads.",
  "Nothing exists alone.",
  "The night is full of music.",
  "Every signal connects to another.",
  "Begin somewhere beautiful.",
];

const homeStyles = `
.vesper-home {
  --bg: #080909;
  --ink: #eee9df;
  --muted: #858781;
  --dim: #50534f;
  --gold: #cbb78c;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 72% 48%, rgba(203,183,140,.065), transparent 26rem),
    radial-gradient(circle at 20% 20%, rgba(255,255,255,.025), transparent 25rem),
    var(--bg);
  color: var(--ink);
  font-family: var(--font-geist-sans), Arial, sans-serif;
}

.vesper-home *,
.vesper-home *::before,
.vesper-home *::after {
  box-sizing: border-box;
}

.vesper-home h1,
.vesper-home h2 {
  font-family: var(--font-cormorant), Georgia, serif;
  font-weight: 400;
}

.vesper-home button,
.vesper-home input {
  font-family: var(--font-geist-sans), Arial, sans-serif;
}

.vesper-intro {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  background: #080909;
  transition: opacity 1.1s ease, visibility 1.1s ease;
}

.vesper-intro.is-leaving {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.vesper-intro-inner {
  position: relative;
  width: min(420px, 80vw);
  text-align: center;
}

.vesper-intro-moon {
  width: 62px;
  height: 62px;
  margin: 0 auto 35px;
  border-radius: 50%;
  background: #e7e1d3;
  box-shadow:
    0 0 35px rgba(231,225,211,.18),
    0 0 100px rgba(203,183,140,.08);
  animation: intro-breathe 3s ease-in-out infinite;
}

.vesper-intro-moon::after {
  content: "";
  position: absolute;
  width: 62px;
  height: 62px;
  margin-left: 18px;
  margin-top: -4px;
  border-radius: 50%;
  background: #080909;
}

.vesper-intro-motto {
  margin: 0;
  color: #d7d2c7;
  font-family: var(--font-cormorant), Georgia, serif !important;
  font-size: clamp(1.8rem, 4vw, 2.7rem);
  line-height: 1;
  letter-spacing: -.035em;
}

.vesper-intro-line {
  width: 60px;
  height: 1px;
  margin: 26px auto 0;
  background: rgba(203,183,140,.55);
  animation: intro-line 2s ease-in-out infinite;
}

.vesper-intro-stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.vesper-intro-stars span {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(238,233,223,.65);
  animation: intro-twinkle 3s ease-in-out infinite;
}

.vesper-intro-stars span:nth-child(1) { left: 12%; top: 18%; animation-delay: -.5s; }
.vesper-intro-stars span:nth-child(2) { left: 84%; top: 23%; animation-delay: -1.4s; }
.vesper-intro-stars span:nth-child(3) { left: 19%; top: 76%; animation-delay: -2s; }
.vesper-intro-stars span:nth-child(4) { left: 78%; top: 73%; animation-delay: -.8s; }
.vesper-intro-stars span:nth-child(5) { left: 48%; top: 12%; animation-delay: -1.8s; }
.vesper-intro-stars span:nth-child(6) { left: 52%; top: 88%; animation-delay: -.2s; }

.vesper-intro-skip {
  position: absolute;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  border: 0;
  background: transparent;
  color: #444741;
  font-size: 8px;
  letter-spacing: .18em;
  cursor: pointer;
}

.vesper-stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.vesper-stars span {
  position: absolute;
  width: 1px;
  height: 1px;
  border-radius: 50%;
  background: rgba(238,233,223,.32);
}

.vesper-stars span:nth-child(3n) {
  width: 2px;
  height: 2px;
  background: rgba(203,183,140,.42);
}

.vesper-nav {
  position: relative;
  z-index: 10;
  width: min(1360px, calc(100% - 64px));
  margin: 0 auto;
  height: 92px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.vesper-logo {
  display: flex;
  align-items: center;
  gap: 11px;
  color: #eee9df;
  text-decoration: none;
  font-size: 11px;
  letter-spacing: .25em;
}

.vesper-logo-moon {
  color: var(--gold);
  font-family: "Times New Roman", Georgia, serif;
  font-size: 21px;
}

.vesper-nav-label {
  color: #565852;
  font-size: 8px;
  letter-spacing: .2em;
}

.vesper-hero {
  position: relative;
  min-height: calc(100vh - 92px);
  width: min(1360px, calc(100% - 64px));
  margin: 0 auto;
  display: grid;
  grid-template-columns: .9fr 1.1fr;
  align-items: center;
}

.vesper-copy {
  position: relative;
  z-index: 5;
  padding-bottom: 8vh;
}

.vesper-eyebrow {
  color: var(--gold);
  font-size: 8px;
  letter-spacing: .24em;
}

.vesper-title {
  margin: 22px 0 22px;
  font-size: clamp(5.5rem, 11vw, 11.5rem);
  line-height: .7;
  letter-spacing: -.075em;
}

.vesper-motto {
  margin: 0;
  color: #979890;
  font-size: 12px;
  line-height: 1.7;
  letter-spacing: .03em;
}

.vesper-search {
  margin-top: 46px;
  width: min(590px, 100%);
}

.vesper-search-shell {
  position: relative;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(238,233,223,.22);
  transition: border-color .3s ease;
}

.vesper-search-shell:focus-within {
  border-color: rgba(203,183,140,.7);
}

.vesper-search-input {
  width: 100%;
  height: 58px;
  padding: 0 52px 0 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #eee9df;
  font-size: 17px;
}

.vesper-search-input::placeholder {
  color: #4f524e;
}

.vesper-search-submit {
  position: absolute;
  right: 0;
  border: 0;
  background: transparent;
  color: var(--gold);
  font-size: 17px;
  cursor: pointer;
}

.vesper-search-status {
  margin-top: 12px;
  color: #565852;
  font-size: 8px;
  letter-spacing: .12em;
}

.vesper-results {
  margin-top: 15px;
  max-height: min(52vh, 520px);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(238,233,223,.1);
  background: rgba(8,9,9,.78);
  backdrop-filter: blur(18px);
  scrollbar-width: thin;
  scrollbar-color: rgba(203,183,140,.42) transparent;
}

.vesper-results::-webkit-scrollbar {
  width: 5px;
}

.vesper-results::-webkit-scrollbar-track {
  background: transparent;
}

.vesper-results::-webkit-scrollbar-thumb {
  background: rgba(203,183,140,.32);
  border-radius: 999px;
}

.vesper-results::-webkit-scrollbar-thumb:hover {
  background: rgba(203,183,140,.52);
}

.vesper-result {
  width: 100%;
  min-height: 65px;
  padding: 10px 15px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 20px;
  align-items: center;
  border: 0;
  border-bottom: 1px solid rgba(238,233,223,.07);
  background: transparent;
  color: #aaa9a2;
  text-align: left;
  cursor: pointer;
  transition: background .25s ease, color .25s ease, padding .3s ease;
}

.vesper-result:last-child {
  border-bottom: 0;
}

.vesper-result:hover {
  padding-left: 22px;
  background: rgba(203,183,140,.035);
  color: #eee9df;
}

.vesper-result-name {
  font-family: var(--font-cormorant), Georgia, serif !important;
  font-size: 21px;
}

.vesper-result-meta {
  display: flex;
  gap: 9px;
  color: #50534f;
  font-size: 8px;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.vesper-result-arrow {
  color: var(--gold);
}

.vesper-upload {
  margin-top: 18px;
}

.vesper-upload-label {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #565852;
  font-size: 8px;
  letter-spacing: .16em;
  cursor: pointer;
  transition: color .25s ease;
}

.vesper-upload-label:hover {
  color: var(--gold);
}

.vesper-upload-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.vesper-upload-player {
  width: min(590px, 100%);
  margin-top: 14px;
}

.vesper-upload-name {
  margin-bottom: 8px;
  color: #777971;
  font-size: 8px;
  letter-spacing: .1em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vesper-upload-audio {
  width: 100%;
  height: 32px;
  filter: grayscale(1) contrast(.8);
}

.vesper-orbit {
  position: relative;
  width: min(700px, 53vw);
  aspect-ratio: 1;
  justify-self: end;
  transform-style: preserve-3d;
  transition: transform .7s cubic-bezier(.2,.8,.2,1);
}

.vesper-orbit-glow {
  position: absolute;
  inset: 15%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(203,183,140,.15), transparent 65%);
  filter: blur(30px);
}

.vesper-orbit-ring {
  position: absolute;
  border: 1px solid rgba(238,233,223,.09);
  border-radius: 50%;
}

.vesper-orbit-ring.one {
  inset: 4%;
}

.vesper-orbit-ring.two {
  inset: 17%;
  border-color: rgba(203,183,140,.13);
  transform: rotate(17deg) scaleY(.66);
}

.vesper-orbit-ring.three {
  inset: 29%;
  transform: rotate(-25deg) scaleY(.75);
}

.vesper-orbit-ring.four {
  inset: 41%;
  border-color: rgba(238,233,223,.12);
}

.vesper-moon {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 132px;
  height: 132px;
  margin: -66px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 29%, rgba(255,255,255,.85), transparent 5%),
    radial-gradient(circle at 60% 62%, rgba(0,0,0,.13), transparent 8%),
    radial-gradient(circle at 35% 70%, rgba(0,0,0,.09), transparent 12%),
    #ddd8cc;
  box-shadow:
    0 0 50px rgba(230,223,208,.1),
    0 0 150px rgba(203,183,140,.06);
  animation: moon-breathe 7s ease-in-out infinite;
}

.vesper-moon::after {
  content: "";
  position: absolute;
  inset: -13px;
  border: 1px solid rgba(203,183,140,.18);
  border-radius: 50%;
}

.vesper-orbit-label {
  position: absolute;
  left: 50%;
  top: 50%;
  color: #777870;
  font-family: "Times New Roman", Georgia, serif !important;
  font-size: 19px;
}

.vesper-orbit-label:nth-of-type(1) { transform: translate(-50%, -50%) rotate(0deg) translateY(-300px); }
.vesper-orbit-label:nth-of-type(2) { transform: translate(-50%, -50%) rotate(30deg) translateY(-300px) rotate(-30deg); }
.vesper-orbit-label:nth-of-type(3) { transform: translate(-50%, -50%) rotate(60deg) translateY(-300px) rotate(-60deg); }
.vesper-orbit-label:nth-of-type(4) { transform: translate(-50%, -50%) rotate(90deg) translateY(-300px) rotate(-90deg); }
.vesper-orbit-label:nth-of-type(5) { transform: translate(-50%, -50%) rotate(120deg) translateY(-300px) rotate(-120deg); }
.vesper-orbit-label:nth-of-type(6) { transform: translate(-50%, -50%) rotate(150deg) translateY(-300px) rotate(-150deg); }
.vesper-orbit-label:nth-of-type(7) { transform: translate(-50%, -50%) rotate(180deg) translateY(-300px) rotate(-180deg); }
.vesper-orbit-label:nth-of-type(8) { transform: translate(-50%, -50%) rotate(210deg) translateY(-300px) rotate(-210deg); }
.vesper-orbit-label:nth-of-type(9) { transform: translate(-50%, -50%) rotate(240deg) translateY(-300px) rotate(-240deg); }
.vesper-orbit-label:nth-of-type(10) { transform: translate(-50%, -50%) rotate(270deg) translateY(-300px) rotate(-270deg); }
.vesper-orbit-label:nth-of-type(11) { transform: translate(-50%, -50%) rotate(300deg) translateY(-300px) rotate(-300deg); }
.vesper-orbit-label:nth-of-type(12) { transform: translate(-50%, -50%) rotate(330deg) translateY(-300px) rotate(-330deg); }

.vesper-small-caption {
  position: absolute;
  right: 8%;
  bottom: 13%;
  color: #4f524e;
  font-size: 8px;
  letter-spacing: .16em;
}

@keyframes intro-breathe {
  0%, 100% { transform: scale(.96); opacity: .8; }
  50% { transform: scale(1.04); opacity: 1; }
}

@keyframes intro-line {
  0%, 100% { transform: scaleX(.55); opacity: .3; }
  50% { transform: scaleX(1); opacity: .8; }
}

@keyframes intro-twinkle {
  0%, 100% { opacity: .15; transform: scale(.8); }
  50% { opacity: .9; transform: scale(1.4); }
}

@keyframes moon-breathe {
  0%, 100% { transform: scale(.98); }
  50% { transform: scale(1.025); }
}

@media (max-width: 900px) {
  .vesper-nav,
  .vesper-hero {
    width: min(100% - 36px, 720px);
  }

  .vesper-hero {
    grid-template-columns: 1fr;
  }

  .vesper-copy {
    padding-top: 8vh;
    padding-bottom: 4vh;
  }

  .vesper-orbit {
    width: min(700px, 100vw);
    justify-self: center;
  }
}

@media (max-width: 620px) {
  .vesper-nav {
    height: 72px;
  }

  .vesper-nav-label {
    display: none;
  }

  .vesper-title {
    font-size: 5rem;
  }

  .vesper-orbit {
    width: 105vw;
    margin-left: -2.5vw;
  }

  .vesper-moon {
    width: 100px;
    height: 100px;
    margin: -50px;
  }

  .vesper-orbit-label:nth-of-type(1) { transform: translate(-50%, -50%) rotate(0deg) translateY(-235px) rotate(0deg); }
  .vesper-orbit-label:nth-of-type(2) { transform: translate(-50%, -50%) rotate(30deg) translateY(-235px) rotate(-30deg); }
  .vesper-orbit-label:nth-of-type(3) { transform: translate(-50%, -50%) rotate(60deg) translateY(-235px) rotate(-60deg); }
  .vesper-orbit-label:nth-of-type(4) { transform: translate(-50%, -50%) rotate(90deg) translateY(-235px) rotate(-90deg); }
  .vesper-orbit-label:nth-of-type(5) { transform: translate(-50%, -50%) rotate(120deg) translateY(-235px) rotate(-120deg); }
  .vesper-orbit-label:nth-of-type(6) { transform: translate(-50%, -50%) rotate(150deg) translateY(-235px) rotate(-150deg); }
  .vesper-orbit-label:nth-of-type(7) { transform: translate(-50%, -50%) rotate(180deg) translateY(-235px) rotate(-180deg); }
  .vesper-orbit-label:nth-of-type(8) { transform: translate(-50%, -50%) rotate(210deg) translateY(-235px) rotate(-210deg); }
  .vesper-orbit-label:nth-of-type(9) { transform: translate(-50%, -50%) rotate(240deg) translateY(-235px) rotate(-240deg); }
  .vesper-orbit-label:nth-of-type(10) { transform: translate(-50%, -50%) rotate(270deg) translateY(-235px) rotate(-270deg); }
  .vesper-orbit-label:nth-of-type(11) { transform: translate(-50%, -50%) rotate(300deg) translateY(-235px) rotate(-300deg); }
  .vesper-orbit-label:nth-of-type(12) { transform: translate(-50%, -50%) rotate(330deg) translateY(-235px) rotate(-330deg); }
}

@media (prefers-reduced-motion: reduce) {
  .vesper-home *,
  .vesper-home *::before,
  .vesper-home *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
  }
}
`;

export default function HomePage() {
  const router = useRouter();
  const { setSong } = useMusic();

  const [introVisible, setIntroVisible] =
    useState(true);

  const [introLeaving, setIntroLeaving] =
    useState(false);

  const [motto, setMotto] =
    useState(mottos[0]);

  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState<SongResult[]>([]);

  const [searching, setSearching] =
    useState(false);

  const [error, setError] =
    useState("");

  const [discoveryMode, setDiscoveryMode] =
    useState(false);

  const [mouse, setMouse] = useState({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const index = Math.floor(
      Math.random() * mottos.length
    );

    setMotto(mottos[index]);

    const leaveTimer =
      window.setTimeout(() => {
        setIntroLeaving(true);
      }, 2100);

    const hideTimer =
      window.setTimeout(() => {
        setIntroVisible(false);
      }, 3200);

    return () => {
      window.clearTimeout(
        leaveTimer
      );
      window.clearTimeout(
        hideTimer
      );
    };
  }, []);

  useEffect(() => {
    function handlePointerMove(
      event: PointerEvent
    ) {
      setMouse({
        x:
          event.clientX /
            window.innerWidth -
          0.5,
        y:
          event.clientY /
            window.innerHeight -
          0.5,
      });
    }

    window.addEventListener(
      "pointermove",
      handlePointerMove
    );

    return () =>
      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );
  }, []);

  function finishIntro() {
    setIntroLeaving(true);

    window.setTimeout(() => {
      setIntroVisible(false);
    }, 900);
  }

  async function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      return;
    }

    setSearching(true);
    setError("");
    setDiscoveryMode(false);
    setResults([]);

    try {
      let serverSongs: SongResult[] = [];
      let serverError = "";

      try {
        const response = await fetch(
          `/api/music/song-search?q=${encodeURIComponent(
            trimmed
          )}`
        );

        const data = await response.json();

        serverSongs = Array.isArray(data.songs)
          ? (data.songs as SongResult[])
          : [];

        if (Array.isArray(data.songs) && data.songs.length > 0) {
          setDiscoveryMode(Boolean(data.discoveryMode));
        }

        if (!response.ok || data.unavailable) {
          serverError =
            typeof data.error === "string"
              ? data.error
              : "The Apple music catalog is temporarily unavailable.";
        }
      } catch {
        serverError =
          "The Apple music catalog could not be reached from the Vesper server.";
      }

      if (serverSongs.length > 0) {
        setResults(serverSongs);
        return;
      }

      // Apple documents JSONP/dynamic-script requests for cross-site searches.
      // Use that browser-side path when the server-side request is rejected.
      // A blocked browser request is handled quietly so it does not create a
      // noisy console error or make the homepage crash.
      try {
        const directSongs = await searchAppleDirect(trimmed);

        if (directSongs.length > 0) {
          setResults(directSongs);
          return;
        }
      } catch {
        // The browser fallback is best-effort. Keep the user-facing catalog
        // error instead of logging the expected Apple rejection to the console.
      }

      setError(
        serverError ||
          "Vesper could not find that signal right now. Please try another search."
      );

      setResults([]);
    } catch {
      setError(
        "Vesper could not find that signal right now. Please try another search."
      );

      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleSongSelect(song: SongResult) {
    const params = new URLSearchParams({
      title: song.title,
      artist: song.artistName,
      ...(song.albumName
        ? { album: song.albumName }
        : {}),
      ...(song.artworkUrl
        ? { artwork: song.artworkUrl }
        : {}),
      ...(song.previewUrl
        ? { preview: song.previewUrl }
        : {}),
      ...(song.playback.url
        ? { playback: song.playback.url }
        : {}),
      ...(song.playback.provider
        ? { source: song.playback.provider }
        : {}),
      ...(song.playback.externalId
        ? { playbackId: song.playback.externalId }
        : {}),
      ...(song.playback.sourceUrl
        ? { sourceUrl: song.playback.sourceUrl }
        : {}),
    });

    router.push(
      `/song/${encodeURIComponent(song.id)}?${params.toString()}`
    );
  }

  function handleUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("audio/")) {
      setError("Please choose an audio file.");
      return;
    }

    setError("");
    setResults([]);

    const audioUrl = URL.createObjectURL(file);
    const signalId = `local-${Date.now()}`;
    const title = file.name.replace(/\.[^/.]+$/, "");

    setSong({
      id: signalId,
      title,
      artist: "Your recording",
      audioUrl,
      isLocal: true,
    });

    const params = new URLSearchParams({
      id: signalId,
      name: file.name,
      audio: audioUrl,
    });

    router.push(`/song/uploaded?${params.toString()}`);
  }

  return (
    <>
      <style>{homeStyles}</style>

      <main className="vesper-home">
        {introVisible && (
          <div
            className={`vesper-intro ${
              introLeaving
                ? "is-leaving"
                : ""
            }`}
          >
            <div className="vesper-intro-stars">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="vesper-intro-inner">
              <div className="vesper-intro-moon" />

              <p className="vesper-intro-motto">
                {motto}
              </p>

              <div className="vesper-intro-line" />
            </div>

            <button
              type="button"
              className="vesper-intro-skip"
              onClick={finishIntro}
            >
              SKIP
            </button>
          </div>
        )}

        <div className="vesper-stars">
          {Array.from({
            length: 70,
          }).map((_, index) => (
            <span
              key={index}
              style={{
                left: `${(
                  (index * 37.17) %
                  100
                ).toFixed(2)}%`,
                top: `${(
                  (index * 61.31) %
                  100
                ).toFixed(2)}%`,
                opacity:
                  0.18 +
                  ((index * 17) % 60) /
                    100,
              }}
            />
          ))}
        </div>

        <nav className="vesper-nav">
          <a
            href="/"
            className="vesper-logo"
          >
            <span className="vesper-logo-moon">
              ☽
            </span>
            VESPER
          </a>

        </nav>

        <section className="vesper-hero">
          <div className="vesper-copy">
            <span className="vesper-eyebrow">
              AN ATLAS OF SOUND
            </span>

            <h1 className="vesper-title">
              Vesper
            </h1>

            <p className="vesper-motto">
              Music, mapped differently.
            </p>

            <form
              className="vesper-search"
              onSubmit={handleSearch}
            >
              <div className="vesper-search-shell">
                <input
                  className="vesper-search-input"
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value
                    )
                  }
                  placeholder="Search a song..."
                  aria-label="Search a song"
                />

                <button
                  type="submit"
                  className="vesper-search-submit"
                  aria-label="Search"
                >
                  {searching
                    ? "·"
                    : "→"}
                </button>
              </div>

              {error && (
                <div className="vesper-search-status">
                  {error}
                </div>
              )}

              {!error &&
                discoveryMode &&
                results.length > 0 && (
                  <div className="vesper-search-status">
                    DISCOVERY MODE · APPLE PREVIEWS MAY BE UNAVAILABLE
                  </div>
                )}

              {!error &&
                searching && (
                  <div className="vesper-search-status">
                    LISTENING FOR THE SIGNAL
                  </div>
                )}

              {results.length > 0 && (
                <div className="vesper-results">
                  {results.map((song) => (
                    <button
                      type="button"
                      key={song.id}
                      className="vesper-result"
                      onClick={() =>
                        handleSongSelect(song)
                      }
                    >
                      <span>
                        <span className="vesper-result-name">
                          {song.title}
                        </span>

                        <span className="vesper-result-meta">
                          <span>{song.artistName}</span>

                          {song.albumName && (
                            <span>
                              {song.albumName}
                            </span>
                          )}

                          {song.playback.provider === "soundcloud" && (
                            <span>SOUNDCLOUD</span>
                          )}

                          {discoveryMode && !song.previewUrl && (
                            <span>DISCOVERY</span>
                          )}
                        </span>
                      </span>

                      <span className="vesper-result-arrow">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="vesper-upload">
                <label className="vesper-upload-label">
                  <input
                    className="vesper-upload-input"
                    type="file"
                    accept="audio/*"
                    onChange={handleUpload}
                  />
                  + UPLOAD A SONG
                </label>
              </div>

            </form>
          </div>

          <div
            className="vesper-orbit"
            style={{
              transform: `
                translate3d(
                  ${mouse.x * 22}px,
                  ${mouse.y * 16}px,
                  0
                )
              `,
            }}
          >
            <div className="vesper-orbit-glow" />

            <div className="vesper-orbit-ring one" />
            <div className="vesper-orbit-ring two" />
            <div className="vesper-orbit-ring three" />
            <div className="vesper-orbit-ring four" />

            <div className="vesper-moon" />

            {zodiacSigns.map(
              (glyph, index) => (
                <span
                  key={glyph}
                  className="vesper-orbit-label"
                >
                  {glyph}
                </span>
              )
            )}

            <span className="vesper-small-caption">
              12 POINTS / ONE SKY
            </span>
          </div>
        </section>
      </main>
    </>
  );
}