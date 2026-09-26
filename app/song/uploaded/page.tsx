"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMusic } from "../../components/MusicProvider";

const zodiacSigns = [
  "♈︎", "♉︎", "♊︎", "♋︎", "♌︎", "♍︎",
  "♎︎", "♏︎", "♐︎", "♑︎", "♒︎", "♓︎",
];

const styles = `
.uploaded-page { --bg:#080909; --ink:#eee9df; --muted:#858781; --dim:#50534f; --gold:#cbb78c; min-height:100vh; overflow:hidden; position:relative; background:radial-gradient(circle at 50% 45%,rgba(203,183,140,.08),transparent 30rem),radial-gradient(circle at 20% 15%,rgba(255,255,255,.025),transparent 24rem),var(--bg); color:var(--ink); font-family:var(--font-geist-sans),Arial,sans-serif; }
.uploaded-page *, .uploaded-page *::before, .uploaded-page *::after { box-sizing:border-box; }
.uploaded-page h1 { font-family:var(--font-cormorant),Georgia,serif; font-weight:400; }
.uploaded-stars { position:absolute; inset:0; pointer-events:none; }
.uploaded-stars span { position:absolute; width:1px; height:1px; border-radius:50%; background:rgba(238,233,223,.28); animation:uploaded-twinkle 4s ease-in-out infinite; }
.uploaded-nav { position:relative; z-index:10; width:min(1360px,calc(100% - 64px)); height:92px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; }
.uploaded-back { color:#656862; text-decoration:none; font-size:8px; letter-spacing:.18em; transition:color .25s ease; }
.uploaded-back:hover { color:var(--gold); }
.uploaded-mark { color:#eee9df; font-size:10px; letter-spacing:.28em; }
.uploaded-stage { position:relative; z-index:2; width:min(1360px,calc(100% - 64px)); min-height:calc(100vh - 92px); margin:0 auto; display:grid; grid-template-columns:.9fr 1.1fr; align-items:center; gap:4rem; }
.uploaded-copy { position:relative; z-index:5; padding-bottom:7vh; }
.uploaded-eyebrow { color:var(--gold); font-size:8px; letter-spacing:.24em; }
.uploaded-title { margin:18px 0 6px; max-width:680px; font-size:clamp(4rem,8vw,8rem); line-height:.78; letter-spacing:-.055em; overflow-wrap:anywhere; }
.uploaded-meta { color:#aaa9a2; font-family:var(--font-cormorant),Georgia,serif; font-size:clamp(1.7rem,3vw,2.7rem); }
.uploaded-file { margin-top:10px; color:#5f625d; font-size:9px; letter-spacing:.13em; text-transform:uppercase; overflow-wrap:anywhere; }
.uploaded-player { width:min(560px,100%); margin-top:42px; }
.uploaded-progress { width:100%; height:1px; background:rgba(238,233,223,.12); }
.uploaded-progress-fill { width:0; height:1px; background:rgba(203,183,140,.7); transition:width .15s linear; }
.uploaded-controls { margin-top:14px; display:flex; align-items:center; gap:16px; }
.uploaded-play { width:38px; height:38px; border:1px solid rgba(203,183,140,.4); border-radius:50%; background:transparent; color:#eee9df; cursor:pointer; transition:all .25s ease; }
.uploaded-play:hover { border-color:var(--gold); box-shadow:0 0 24px rgba(203,183,140,.08); }
.uploaded-time { color:#575a55; font-size:8px; letter-spacing:.1em; }
.uploaded-note { margin-top:18px; color:#454843; font-size:8px; letter-spacing:.14em; }
.uploaded-art-field { position:relative; width:min(650px,54vw); aspect-ratio:1; justify-self:end; display:grid; place-items:center; }
.uploaded-glow { position:absolute; inset:12%; border-radius:50%; background:radial-gradient(circle,rgba(203,183,140,.16),transparent 64%); filter:blur(35px); animation:uploaded-breathe 7s ease-in-out infinite; }
.uploaded-ring { position:absolute; border:1px solid rgba(238,233,223,.09); border-radius:50%; }
.uploaded-ring.one { inset:3%; }
.uploaded-ring.two { inset:14%; transform:rotate(16deg) scaleY(.7); border-color:rgba(203,183,140,.13); }
.uploaded-ring.three { inset:27%; transform:rotate(-25deg) scaleY(.76); }
.uploaded-ring.four { inset:39%; border-color:rgba(238,233,223,.12); }
.uploaded-disc { position:relative; z-index:4; width:min(270px,38vw); aspect-ratio:1; border-radius:50%; background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.72),transparent 3%),radial-gradient(circle at 66% 64%,rgba(0,0,0,.12),transparent 7%),linear-gradient(145deg,#d9d4c8,#aaa69b); box-shadow:0 0 50px rgba(230,223,208,.1),0 0 150px rgba(203,183,140,.08); animation:uploaded-breathe 6s ease-in-out infinite; }
.uploaded-disc::before { content:""; position:absolute; inset:16%; border:1px solid rgba(40,40,38,.18); border-radius:50%; box-shadow:inset 0 0 30px rgba(0,0,0,.08); }
.uploaded-disc::after { content:""; position:absolute; left:50%; top:50%; width:9px; height:9px; margin:-4.5px; border-radius:50%; background:#2d2e2b; box-shadow:0 0 0 3px rgba(238,233,223,.2); }
.uploaded-zodiac { position:absolute; inset:0; z-index:3; animation:uploaded-orbit 70s linear infinite; }
.uploaded-zodiac span { position:absolute; left:50%; top:50%; color:#686b65; font-family:"Times New Roman",Georgia,serif; font-size:18px; }
.uploaded-zodiac span:nth-child(1){transform:translate(-50%,-50%) rotate(0deg) translateY(-47%) rotate(0deg)} .uploaded-zodiac span:nth-child(2){transform:translate(-50%,-50%) rotate(30deg) translateY(-47%) rotate(-30deg)} .uploaded-zodiac span:nth-child(3){transform:translate(-50%,-50%) rotate(60deg) translateY(-47%) rotate(-60deg)} .uploaded-zodiac span:nth-child(4){transform:translate(-50%,-50%) rotate(90deg) translateY(-47%) rotate(-90deg)} .uploaded-zodiac span:nth-child(5){transform:translate(-50%,-50%) rotate(120deg) translateY(-47%) rotate(-120deg)} .uploaded-zodiac span:nth-child(6){transform:translate(-50%,-50%) rotate(150deg) translateY(-47%) rotate(-150deg)} .uploaded-zodiac span:nth-child(7){transform:translate(-50%,-50%) rotate(180deg) translateY(-47%) rotate(-180deg)} .uploaded-zodiac span:nth-child(8){transform:translate(-50%,-50%) rotate(210deg) translateY(-47%) rotate(-210deg)} .uploaded-zodiac span:nth-child(9){transform:translate(-50%,-50%) rotate(240deg) translateY(-47%) rotate(-240deg)} .uploaded-zodiac span:nth-child(10){transform:translate(-50%,-50%) rotate(270deg) translateY(-47%) rotate(-270deg)} .uploaded-zodiac span:nth-child(11){transform:translate(-50%,-50%) rotate(300deg) translateY(-47%) rotate(-300deg)} .uploaded-zodiac span:nth-child(12){transform:translate(-50%,-50%) rotate(330deg) translateY(-47%) rotate(-330deg)}
.uploaded-error { color:#8b6f65; font-size:9px; letter-spacing:.12em; line-height:1.7; }
@keyframes uploaded-orbit { from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes uploaded-breathe { 0%,100%{transform:scale(.985)} 50%{transform:scale(1.018)} }
@keyframes uploaded-twinkle { 0%,100%{opacity:.18} 50%{opacity:.75} }
@media(max-width:900px){ .uploaded-nav,.uploaded-stage{width:min(100% - 36px,720px)} .uploaded-stage{grid-template-columns:1fr;gap:0;padding-top:7vh}.uploaded-copy{padding-bottom:3vh}.uploaded-art-field{width:min(680px,100vw);justify-self:center} }
@media(max-width:620px){ .uploaded-nav{height:72px}.uploaded-nav,.uploaded-stage{width:calc(100% - 36px)}.uploaded-title{font-size:4.5rem}.uploaded-disc{width:55vw}.uploaded-art-field{width:110vw;margin-left:-5vw} }
@media(prefers-reduced-motion:reduce){.uploaded-page *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
`;

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "00 : 00";
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")} : ${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
}

export default function UploadedSongPage() {
  const searchParams = useSearchParams();
  const {
    song: activeSong,
    playing,
    currentTime,
    duration,
    autoplayBlocked,
    setSong,
    togglePlayback,
  } = useMusic();

  const fileName = searchParams.get("name") ?? "Your recording";
  const audioUrl = searchParams.get("audio") ?? "";
  const signalId = searchParams.get("id") ?? `local-${fileName}`;

  const localSong = useMemo(
    () => ({
      id: signalId,
      title: fileName.replace(/\.[^/.]+$/, ""),
      artist: "Your recording",
      audioUrl,
    }),
    [audioUrl, fileName, signalId]
  );

  useEffect(() => {
    if (!audioUrl) return;

    if (activeSong?.id === localSong.id && activeSong.audioUrl === audioUrl) {
      return;
    }

    setSong({
      id: localSong.id,
      title: localSong.title,
      artist: localSong.artist,
      audioUrl: localSong.audioUrl,
      isLocal: true,
    });
  }, [activeSong?.audioUrl, activeSong?.id, audioUrl, localSong, setSong]);

  const isActive = activeSong?.id === localSong.id;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <style>{styles}</style>
      <main className="uploaded-page">
        <div className="uploaded-stars">
          {Array.from({ length: 60 }).map((_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 41.7) % 100}%`,
                top: `${(i * 67.3) % 100}%`,
                animationDelay: `-${(i % 7) * 0.55}s`,
              }}
            />
          ))}
        </div>

        <nav className="uploaded-nav">
          <Link className="uploaded-back" href="/">
            ← RETURN TO VESPER
          </Link>
          <span className="uploaded-mark">LOCAL SIGNAL</span>
        </nav>

        <section className="uploaded-stage">
          <div className="uploaded-copy">
            <span className="uploaded-eyebrow">01 / THE SIGNAL</span>
            <h1 className="uploaded-title">
              {localSong.title}
            </h1>
            <div className="uploaded-meta">Your recording</div>
            <div className="uploaded-file">PLAYING FROM THIS DEVICE</div>

            {!audioUrl ? (
              <p className="uploaded-error">
                No uploaded signal was found. Return to Vesper and upload an
                audio file again.
              </p>
            ) : (
              <div className="uploaded-player">
                <div className="uploaded-progress">
                  <div
                    className="uploaded-progress-fill"
                    style={{ width: `${isActive ? progress : 0}%` }}
                  />
                </div>

                <div className="uploaded-controls">
                  <button
                    className="uploaded-play"
                    type="button"
                    onClick={togglePlayback}
                    disabled={!isActive}
                  >
                    {playing && isActive ? "Ⅱ" : "▶"}
                  </button>
                  <span className="uploaded-time">
                    {formatTime(isActive ? currentTime : 0)} / {formatTime(isActive ? duration : 0)}
                  </span>
                </div>

                <div className="uploaded-note">
                  {isActive && autoplayBlocked
                    ? "PRESS PLAY TO ENTER THE SIGNAL"
                    : "FULL LOCAL AUDIO · NOTHING LEAVES THIS DEVICE"}
                </div>
              </div>
            )}
          </div>

          <div className="uploaded-art-field">
            <div className="uploaded-glow" />
            <div className="uploaded-ring one" />
            <div className="uploaded-ring two" />
            <div className="uploaded-ring three" />
            <div className="uploaded-ring four" />
            <div className="uploaded-zodiac">
              {zodiacSigns.map((glyph) => (
                <span key={glyph}>{glyph}</span>
              ))}
            </div>
            <div className="uploaded-disc" />
          </div>
        </section>
      </main>
    </>
  );
}
