"use client";

import {
  type CSSProperties,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type VesperSong = {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  artwork?: string | null;
  audioUrl: string;
  isLocal?: boolean;
  sourceUrl?: string | null;
  source?: "soundcloud" | "itunes" | "local";
};

type MusicContextValue = {
  song: VesperSong | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  autoplayBlocked: boolean;
  volume: number;
  muted: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setSong: (song: VesperSong, options?: { autoplay?: boolean }) => void;
  togglePlayback: () => void;
  seek: (time: number) => void;
  ready: boolean;
};

const MusicContext = createContext<MusicContextValue | null>(null);

const globalPlayerStyles = `
.vesper-global-player {
  position: fixed;
  left: 22px;
  right: 22px;
  bottom: 18px;
  z-index: 1000;
  display: grid;
  grid-template-columns: 42px minmax(170px, 250px) 42px minmax(160px, 1fr) 118px;
  align-items: center;
  gap: 14px;
  min-height: 66px;
  padding: 9px 14px 9px 9px;
  border: 1px solid rgba(238,233,223,.12);
  background: rgba(8,9,9,.86);
  backdrop-filter: blur(22px);
  box-shadow: 0 18px 60px rgba(0,0,0,.32), 0 0 40px rgba(203,183,140,.035);
  color: #eee9df;
  font-family: var(--font-geist-sans), Arial, sans-serif;
}
.vesper-global-player-art { width:42px; height:42px; border-radius:50%; overflow:hidden; display:grid; place-items:center; border:1px solid rgba(203,183,140,.22); background:#151615; color:#cbb78c; }
.vesper-global-player-art img { width:100%; height:100%; object-fit:cover; }
.vesper-global-player-copy { min-width:0; display:flex; flex-direction:column; gap:2px; }
.vesper-global-player-copy strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:var(--font-cormorant), Georgia, serif; font-size:17px; font-weight:400; }
.vesper-global-player-copy > span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#777a74; font-size:8px; letter-spacing:.12em; text-transform:uppercase; }
.vesper-global-player-label { color:#cbb78c; font-size:6px; letter-spacing:.2em; }
.vesper-global-player-button { width:36px; height:36px; border:1px solid rgba(203,183,140,.32); border-radius:50%; background:transparent; color:#eee9df; cursor:pointer; transition:all .25s ease; }
.vesper-global-player-button:hover { border-color:#cbb78c; box-shadow:0 0 24px rgba(203,183,140,.1); }
.vesper-global-player-track { min-width:0; }
.vesper-global-player-progress { display:block; width:100%; height:18px; padding:8px 0; border:0; background:transparent; cursor:pointer; }
.vesper-global-player-progress::before { content:""; display:block; height:1px; width:100%; background:rgba(238,233,223,.1); }
.vesper-global-player-progress span { display:block; position:relative; top:-1px; height:1px; background:rgba(203,183,140,.75); transition:width .12s linear; }
.vesper-global-player-time { display:flex; justify-content:space-between; color:#555852; font-size:7px; letter-spacing:.12em; }
.vesper-global-player-volume { display:flex; align-items:center; gap:9px; min-width:0; }
.vesper-global-player-volume-button { width:24px; height:24px; flex:0 0 24px; border:0; background:transparent; color:#777a74; padding:0; cursor:pointer; font-size:11px; transition:color .25s ease; }
.vesper-global-player-volume-button:hover { color:#cbb78c; }
.vesper-global-player-volume-slider { width:100%; height:18px; margin:0; appearance:none; -webkit-appearance:none; background:transparent; cursor:pointer; }
.vesper-global-player-volume-slider::-webkit-slider-runnable-track { height:1px; background:linear-gradient(to right, rgba(203,183,140,.72) 0%, rgba(203,183,140,.72) var(--volume), rgba(238,233,223,.1) var(--volume), rgba(238,233,223,.1) 100%); }
.vesper-global-player-volume-slider::-moz-range-track { height:1px; background:rgba(238,233,223,.1); }
.vesper-global-player-volume-slider::-moz-range-progress { height:1px; background:rgba(203,183,140,.72); }
.vesper-global-player-volume-slider::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:7px; height:7px; margin-top:-3px; border:0; border-radius:50%; background:#cbb78c; box-shadow:0 0 10px rgba(203,183,140,.16); }
.vesper-global-player-volume-slider::-moz-range-thumb { width:7px; height:7px; border:0; border-radius:50%; background:#cbb78c; box-shadow:0 0 10px rgba(203,183,140,.16); }
.vesper-global-player-volume-label { color:#555852; font-size:7px; letter-spacing:.1em; min-width:25px; text-align:right; }
@media(max-width:720px) {
  .vesper-global-player { left:10px; right:10px; bottom:10px; grid-template-columns:38px minmax(0,1fr) 38px; gap:10px; }
  .vesper-global-player-art { width:38px; height:38px; }
  .vesper-global-player-track { grid-column:1 / -1; }
  .vesper-global-player-volume { grid-column:1 / -1; }
}
`;

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const songRef = useRef<VesperSong | null>(null);
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const [song, setSongState] = useState<VesperSong | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [volume, setVolumeState] = useState(0.58);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  const persistPlayback = useCallback(
    (nextSong: VesperSong, time: number) => {
      if (nextSong.isLocal) return;

      try {
        const key = nextSong.id;
        const saved = window.localStorage.getItem("vesper-playback-positions");
        const positions = saved ? (JSON.parse(saved) as Record<string, number>) : {};
        positions[key] = Math.max(0, Number.isFinite(time) ? time : 0);
        window.localStorage.setItem("vesper-playback-positions", JSON.stringify(positions));
        window.localStorage.setItem(
          "vesper-playback",
          JSON.stringify({ song: nextSong, time: positions[key] })
        );
      } catch {
        // Local storage can be unavailable in some browser contexts.
      }
    },
    []
  );

  const readSavedPosition = useCallback((songId: string) => {
    try {
      const saved = window.localStorage.getItem("vesper-playback-positions");
      if (!saved) return 0;
      const positions = JSON.parse(saved) as Record<string, unknown>;
      const value = positions[songId];
      return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = 0.58;
    audioRef.current = audio;

    let restoredTime = 0;
    let restoredSong: VesperSong | null = null;
    let restoreCleanup: (() => void) | null = null;

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);

      const currentSong = songRef.current;
      const desiredTime = restoredTime > 0
        ? restoredTime
        : currentSong && !currentSong.isLocal
          ? readSavedPosition(currentSong.id)
          : 0;

      if (desiredTime > 0 && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(desiredTime, audio.duration);
        setCurrentTime(audio.currentTime);
      }

      // The refresh-restored timestamp applies only to the song that was
      // restored during provider startup. Once that metadata has loaded,
      // later songs must use their own per-song saved positions instead of
      // inheriting the restored song's timestamp.
      restoredTime = 0;
    };

    const handleDurationChange = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => {
      setPlaying(true);
      setAutoplayBlocked(false);
    };

    const handlePause = () => {
      setPlaying(false);
      setSongState((currentSong) => {
        if (currentSong && !currentSong.isLocal) {
          persistPlayback(currentSong, audio.currentTime);
        }
        return currentSong;
      });
    };

    const handleEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
      setSongState((currentSong) => {
        if (currentSong && !currentSong.isLocal) {
          persistPlayback(currentSong, 0);
        }
        return currentSong;
      });
    };

    const handleBeforeUnload = () => {
      if (!restoredSong && !audio.src) return;

      const currentSong = songRef.current;
      if (currentSong && !currentSong.isLocal) {
        persistPlayback(currentSong, audio.currentTime);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    window.addEventListener("beforeunload", handleBeforeUnload);

    try {
      const savedVolume = window.localStorage.getItem("vesper-volume");
      if (savedVolume !== null) {
        const parsedVolume = Number(savedVolume);
        if (Number.isFinite(parsedVolume)) {
          const nextVolume = Math.max(0, Math.min(1, parsedVolume));
          audio.volume = nextVolume;
          setVolumeState(nextVolume);
          setMuted(nextVolume === 0);
        }
      }

      const savedPlayback = window.localStorage.getItem("vesper-playback");

      if (savedPlayback) {
        const parsedPlayback = JSON.parse(savedPlayback) as {
          song?: Partial<VesperSong>;
          time?: number;
        };
        const parsedSong = parsedPlayback.song;

        if (
          parsedSong &&
          typeof parsedSong.id === "string" &&
          typeof parsedSong.title === "string" &&
          typeof parsedSong.artist === "string" &&
          typeof parsedSong.audioUrl === "string" &&
          parsedSong.audioUrl.length > 0 &&
          parsedSong.isLocal !== true
        ) {
          restoredSong = {
            id: parsedSong.id,
            title: parsedSong.title,
            artist: parsedSong.artist,
            album: parsedSong.album ?? null,
            artwork: parsedSong.artwork ?? null,
            audioUrl: parsedSong.audioUrl,
            isLocal: false,
            sourceUrl: parsedSong.sourceUrl ?? null,
            source:
              parsedSong.source === "soundcloud"
                ? "soundcloud"
                : parsedSong.source === "local"
                  ? "local"
                  : "itunes",
          };

          restoredTime = readSavedPosition(restoredSong.id);
          if (restoredTime === 0 && typeof parsedPlayback.time === "number" && Number.isFinite(parsedPlayback.time) && parsedPlayback.time > 0) {
            restoredTime = parsedPlayback.time;
          }

          songRef.current = restoredSong;
          setSongState(restoredSong);
          setCurrentTime(restoredTime);

          const isSoundCloud = restoredSong.audioUrl.includes(
            "/api/music/soundcloud/stream"
          );

          if (isSoundCloud) {
            void (async () => {
              try {
                const { default: Hls } = await import("hls.js");

                if (Hls.isSupported()) {
                  const hls = new Hls({
                    enableWorker: true,
                    maxBufferLength: 20,
                  });
                  hlsRef.current = hls;

                  hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal) {
                      console.error(
                        "SoundCloud restore playback error:",
                        data
                      );
                      setPlaying(false);
                    }
                  });

                  hls.attachMedia(audio);
                  hls.loadSource(restoredSong!.audioUrl);
                } else {
                  audio.src = restoredSong!.audioUrl;
                  audio.load();
                }
              } catch (error) {
                console.error(
                  "Unable to restore SoundCloud playback:",
                  error
                );
                audio.src = restoredSong!.audioUrl;
                audio.load();
              }
            })();
          } else {
            audio.src = restoredSong.audioUrl;
            audio.load();
          }
        }
      } else {
        const legacySong = window.localStorage.getItem("vesper-song");
        if (legacySong) {
          window.localStorage.removeItem("vesper-song");
        }
      }
    } catch (error) {
      console.error("Unable to restore Vesper playback:", error);
    } finally {
      // The page waits for this flag before attempting to replace a restored song.
      // That removes the refresh race between MusicProvider hydration and SongPage.
      setReady(true);
    }

    restoreCleanup = () => {
      audio.pause();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      audio.removeAttribute("src");
      audio.load();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      audioRef.current = null;
      songRef.current = null;
    };

    return () => {
      restoreCleanup?.();
    };
  }, [persistPlayback, readSavedPosition]);

  const setVolume = useCallback((nextVolume: number) => {
    const audio = audioRef.current;
    const clampedVolume = Math.max(0, Math.min(1, nextVolume));

    setVolumeState(clampedVolume);
    setMuted(clampedVolume === 0);

    if (audio) {
      audio.volume = clampedVolume;
      audio.muted = false;
    }

    try {
      window.localStorage.setItem("vesper-volume", String(clampedVolume));
    } catch {
      // Local storage can be unavailable in some browser contexts.
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (muted || audio.muted || audio.volume === 0) {
      const restoredVolume = volume > 0 ? volume : 0.58;
      audio.muted = false;
      audio.volume = restoredVolume;
      setVolumeState(restoredVolume);
      setMuted(false);

      try {
        window.localStorage.setItem("vesper-volume", String(restoredVolume));
      } catch {
        // Local storage can be unavailable in some browser contexts.
      }
      return;
    }

    audio.muted = true;
    setMuted(true);
  }, [muted, volume]);

  const setSong = useCallback(
    (nextSong: VesperSong, options?: { autoplay?: boolean }) => {
      const audio = audioRef.current;
      if (!audio) return;

      audio.pause();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      audio.removeAttribute("src");
      audio.load();
      audio.currentTime = 0;
      songRef.current = nextSong;
      setSongState(nextSong);

      const savedPosition = nextSong.isLocal ? 0 : readSavedPosition(nextSong.id);
      setCurrentTime(savedPosition);

      try {
        if (nextSong.isLocal) {
          window.localStorage.removeItem("vesper-playback");
        } else {
          persistPlayback(nextSong, savedPosition);
        }
      } catch {
        // Local storage can be unavailable in some browser contexts.
      }
      setDuration(0);
      setPlaying(false);
      setAutoplayBlocked(false);

      const playWhenReady = () => {
        if (options?.autoplay === false) return;

        audio
          .play()
          .then(() => {
            setPlaying(true);
            setAutoplayBlocked(false);
          })
          .catch(() => {
            setPlaying(false);
            setAutoplayBlocked(true);
          });
      };

      if (nextSong.audioUrl.includes("/api/music/soundcloud/stream")) {
        void (async () => {
          try {
            const { default: Hls } = await import("hls.js");

            if (Hls.isSupported()) {
              const hls = new Hls({
                enableWorker: true,
              });
              hlsRef.current = hls;

              hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                  console.error("SoundCloud HLS playback error:", data);
                  setPlaying(false);
                  setAutoplayBlocked(true);
                }
              });

              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                playWhenReady();
              });

              hls.loadSource(nextSong.audioUrl);
              hls.attachMedia(audio);
              return;
            }

            audio.src = nextSong.audioUrl;
            audio.load();
            playWhenReady();
          } catch (error) {
            console.error("Unable to load HLS playback:", error);
            setAutoplayBlocked(true);
          }
        })();
      } else {
        audio.src = nextSong.audioUrl;
        audio.load();
        playWhenReady();
      }
    },
    [persistPlayback, readSavedPosition]
  );

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !song) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => {
          setPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => setAutoplayBlocked(true));
    } else {
      audio.pause();
    }
  }, [song]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
    setCurrentTime(audio.currentTime);
  }, []);

  const value = useMemo(
    () => ({
      song,
      playing,
      currentTime,
      duration,
      autoplayBlocked,
      volume,
      muted,
      setVolume,
      toggleMute,
      setSong,
      togglePlayback,
      seek,
      ready,
    }),
    [
      song,
      playing,
      currentTime,
      duration,
      autoplayBlocked,
      volume,
      muted,
      setVolume,
      toggleMute,
      setSong,
      togglePlayback,
      seek,
      ready,
    ]
  );

  return (
    <MusicContext.Provider value={value}>
      <style>{globalPlayerStyles}</style>
      {children}
      <BackgroundPlayer />
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error("useMusic must be used inside MusicProvider.");
  }
  return context;
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "00:00";
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
}

function BackgroundPlayer() {
  const {
    song,
    playing,
    currentTime,
    duration,
    autoplayBlocked,
    volume,
    muted,
    setVolume,
    toggleMute,
    togglePlayback,
    seek,
  } = useMusic();

  if (!song) return null;

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="vesper-global-player">
      <div className="vesper-global-player-art">
        {song.artwork ? (
          <img src={song.artwork} alt="" />
        ) : (
          <span>☽</span>
        )}
      </div>

      <div className="vesper-global-player-copy">
        <span className="vesper-global-player-label">
          {song.isLocal ? "LOCAL SIGNAL" : "THE SIGNAL"}
        </span>
        <strong>{song.title}</strong>
        <span>{song.artist}</span>
      </div>

      <button
        type="button"
        className="vesper-global-player-button"
        onClick={togglePlayback}
        aria-label={playing ? "Pause song" : "Play song"}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>

      <div className="vesper-global-player-track">
        <button
          type="button"
          className="vesper-global-player-progress"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            seek(ratio * duration);
          }}
          aria-label="Seek through song"
        >
          <span style={{ width: `${progress}%` }} />
        </button>
        <div className="vesper-global-player-time">
          <span>{formatTime(currentTime)}</span>
          <span>{autoplayBlocked ? "PRESS PLAY" : formatTime(duration)}</span>
        </div>
      </div>

      <div className="vesper-global-player-volume">
        <button
          type="button"
          className="vesper-global-player-volume-button"
          onClick={toggleMute}
          aria-label={muted || volume === 0 ? "Unmute song" : "Mute song"}
        >
          {muted || volume === 0 ? "×" : volume < 0.5 ? "◖" : "◗"}
        </button>

        <input
          className="vesper-global-player-volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          style={{ "--volume": `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
          aria-label="Volume"
        />

        <span className="vesper-global-player-volume-label">
          {Math.round((muted ? 0 : volume) * 100)}
        </span>
      </div>
    </div>
  );
}
