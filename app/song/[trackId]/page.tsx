"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  useParams,
  useSearchParams,
} from "next/navigation";
import { useMusic } from "../../components/MusicProvider";

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

type UniverseNode = {
  type: string;
  id: string;
  label: string;
  artist?: string;
  album?: string | null;
  artworkUrl?: string | null;
  previewUrl?: string | null;
  genres?: string[];
  lastFmMatch?: number | null;
};

type UniverseEdge = {
  source: string;
  target: string;
  relationship: string;
};

type UniverseData = {
  source: string;
  sourceId: string | null;
  externalId: string;
  matched: boolean;
  requested: {
    title: string;
    artist: string;
    album: string | null;
  };
  song: {
    id?: string;
    title: string;
    artist:
      | string
      | {
          id: string;
          name: string;
          type: string | null;
        }
      | null;
    durationMs?: number | null;
    disambiguation?: string | null;
  };
  genres: string[];
  releases: Array<{
    id: string;
    title: string;
    date: string | null;
    year: string | null;
    status: string | null;
    country: string | null;
    releaseGroup: {
      id: string | null;
      title: string | null;
      primaryType: string | null;
      secondaryTypes: string[];
    } | null;
    tracks: Array<{
      id: string;
      title: string;
      position: number | null;
      durationMs: number | null;
      recordingId: string | null;
    }>;
  }>;
  releaseGroups: Array<{
    id: string;
    title: string;
    primaryType: string | null;
    secondaryTypes: string[];
  }>;
  relatedArtists: unknown[];
  similarSongs: Array<{
    id: string;
    title: string;
    artist: string;
    artistId: string | null;
    genres: string[];
    score: number;
    lastFmMatch?: number | null;
  }>;
  graph: {
    center: {
      type: string;
      id: string;
    };
    nodes: UniverseNode[];
    edges: UniverseEdge[];
  };
};

type GraphPoint = {
  node: UniverseNode;
  x: number;
  y: number;
};

type JourneyItem = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  artwork: string | null;
  preview: string | null;
};

const JOURNEY_STORAGE_KEY = "vesper-journey-v1";
const MAX_JOURNEY_LENGTH = 12;

const songStyles = `
.song-page {
  --bg: #080909;
  --ink: #eee9df;
  --muted: #858781;
  --dim: #50534f;
  --gold: #cbb78c;

  min-height: 100vh;
  overflow-x: hidden;
  overflow-y: visible;
  position: relative;

  background:
    radial-gradient(
      circle at 50% 45%,
      rgba(203,183,140,.08),
      transparent 30rem
    ),
    radial-gradient(
      circle at 20% 15%,
      rgba(255,255,255,.025),
      transparent 24rem
    ),
    var(--bg);

  color: var(--ink);
  font-family: var(--font-geist-sans), Arial, sans-serif;
}

.song-page *,
.song-page *::before,
.song-page *::after {
  box-sizing: border-box;
}

.song-page h1,
.song-page h2 {
  font-family: var(--font-cormorant), Georgia, serif;
  font-weight: 400;
}

/* -------------------------------------------------- */
/* BACKGROUND */
/* -------------------------------------------------- */

.song-page::before,
.song-page::after {
  content: "";
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  border: 1px solid rgba(238,233,223,.025);
}

.song-page::before {
  width: 760px;
  height: 760px;
  left: 61%;
  top: 48%;
  transform: translate(-50%,-50%);
  animation: background-circle 65s linear infinite;
}

.song-page::after {
  width: 1100px;
  height: 1100px;
  left: 61%;
  top: 48%;
  transform: translate(-50%,-50%);
  border-color: rgba(203,183,140,.012);
  animation: background-circle-reverse 90s linear infinite;
}

.song-nav {
  position: relative;
  z-index: 10;

  width: min(1360px, calc(100% - 64px));
  margin: 0 auto;
  height: 92px;

  display: flex;
  align-items: center;
  justify-content: space-between;
}

.song-back {
  color: #656862;
  text-decoration: none;
  font-size: 8px;
  letter-spacing: .18em;

  transition:
    color .25s ease,
    transform .3s ease;
}

.song-back:hover {
  color: var(--gold);
  transform: translateX(-3px);
}

.song-nav-mark {
  color: #eee9df;
  font-size: 10px;
  letter-spacing: .28em;
  animation: nav-mark-breathe 8s ease-in-out infinite;
}

/* -------------------------------------------------- */
/* STARS */
/* -------------------------------------------------- */

.song-stars {
  position: absolute;
  inset: -5%;
  pointer-events: none;
  animation: stars-field-drift 38s ease-in-out infinite alternate;
}

.song-stars span {
  position: absolute;
  width: 1px;
  height: 1px;
  border-radius: 50%;
  background: rgba(238,233,223,.28);

  animation:
    song-twinkle 4s ease-in-out infinite,
    star-micro-drift 12s ease-in-out infinite alternate;
}

.song-stars span:nth-child(3n) {
  width: 2px;
  height: 2px;
  background: rgba(203,183,140,.35);
}

.song-stars span:nth-child(5n) {
  animation-duration: 7s, 17s;
}

.song-stars span:nth-child(7n) {
  animation-duration: 9s, 21s;
}

/* -------------------------------------------------- */
/* STAGE */
/* -------------------------------------------------- */

.song-stage {
  position: relative;
  z-index: 2;

  min-height: calc(100vh - 92px);

  width: min(1360px, calc(100% - 64px));
  margin: 0 auto;

  display: grid;
  grid-template-columns: .8fr 1.2fr;

  align-items: center;
  gap: 4rem;

  padding-top: 7vh;
  padding-bottom: 10vh;
}

.song-copy {
  position: relative;
  z-index: 5;
  padding-bottom: 7vh;

  animation:
    song-copy-arrival 1.2s cubic-bezier(.2,.8,.2,1) both;
}

.song-eyebrow {
  display: inline-block;
  color: var(--gold);
  font-size: 8px;
  letter-spacing: .24em;

  animation: eyebrow-drift 7s ease-in-out infinite alternate;
}

.song-title {
  margin: 18px 0 6px;
  max-width: 620px;

  font-size: clamp(4.2rem, 8vw, 8rem);
  line-height: .78;
  letter-spacing: -.055em;

  animation:
    title-float 9s ease-in-out infinite alternate,
    title-opacity 6s ease-in-out infinite;
}

.song-artist {
  color: #aaa9a2;
  font-family: var(--font-cormorant), Georgia, serif;
  font-size: clamp(1.8rem,3vw,2.8rem);

  animation:
    artist-float 8s ease-in-out infinite alternate;
}

.song-album {
  margin-top: 9px;
  color: #5f625d;
  font-size: 9px;
  letter-spacing: .13em;
  text-transform: uppercase;

  animation: album-drift 10s ease-in-out infinite alternate;
}

/* -------------------------------------------------- */
/* PLAYER */
/* -------------------------------------------------- */

.song-player {
  margin-top: 42px;
  width: min(560px,100%);
  animation: player-arrival 1.5s .25s cubic-bezier(.2,.8,.2,1) both;
}

.song-progress {
  width: 100%;
  height: 1px;
  background: rgba(238,233,223,.12);
  position: relative;
  overflow: visible;
}

.song-progress::after {
  content: "";
  position: absolute;
  left: 0;
  top: -2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--gold);
  opacity: .6;
  transform: translateX(-2px);
  animation: progress-star 2.5s ease-in-out infinite;
}

.song-progress-fill {
  height: 1px;
  width: 0;
  background: rgba(203,183,140,.7);
  transition: width .15s linear;
}

.song-player-row {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.song-play {
  width: 38px;
  height: 38px;

  border: 1px solid rgba(203,183,140,.4);
  border-radius: 50%;

  background: transparent;
  color: #eee9df;

  cursor: pointer;

  transition:
    border-color .25s ease,
    box-shadow .25s ease,
    transform .3s ease;
}

.song-play:hover:not(:disabled) {
  border-color: var(--gold);
  box-shadow: 0 0 24px rgba(203,183,140,.08);
  transform: scale(1.05);
}

.song-play:disabled {
  opacity: .35;
  cursor: default;
}

.song-time {
  color: #575a55;
  font-size: 8px;
  letter-spacing: .1em;
}

.song-note {
  margin-top: 18px;
  color: #454843;
  font-size: 8px;
  letter-spacing: .14em;

  animation: note-pulse 3s ease-in-out infinite;
}

.song-upload-note {
  margin-top: 28px;
  color: #565852;
  font-size: 8px;
  line-height: 1.7;
  letter-spacing: .08em;
}

.song-upload-note strong {
  color: #888980;
  font-weight: 400;
}

.song-search-online {
  display: inline-flex;
  margin-top: 14px;
  color: #9a9b94;
  font-size: 8px;
  letter-spacing: .14em;
  text-decoration: none;
  border-bottom: 1px solid rgba(203,183,140,.22);
  padding-bottom: 4px;
  transition: color .25s ease, border-color .25s ease;
}

.song-search-online:hover {
  color: var(--gold);
  border-color: rgba(203,183,140,.55);
}

/* -------------------------------------------------- */
/* ART FIELD */
/* -------------------------------------------------- */

.song-art-field {
  position: relative;

  width: min(650px,54vw);
  aspect-ratio: 1;

  justify-self: end;
  display: grid;
  place-items: center;

  animation:
    art-field-arrival 1.5s .1s cubic-bezier(.2,.8,.2,1) both,
    art-field-float 13s ease-in-out infinite alternate;
}

.song-glow {
  position: absolute;
  inset: 12%;

  border-radius: 50%;

  background:
    radial-gradient(
      circle,
      rgba(203,183,140,.16),
      transparent 64%
    );

  filter: blur(35px);

  animation:
    song-breathe 7s ease-in-out infinite,
    glow-pulse 10s ease-in-out infinite;
}

.song-ring {
  position: absolute;
  border: 1px solid rgba(238,233,223,.09);
  border-radius: 50%;
}

.song-ring.one {
  inset: 3%;
  animation: ring-rotate 70s linear infinite;
}

.song-ring.two {
  inset: 14%;
  transform: rotate(16deg) scaleY(.7);
  border-color: rgba(203,183,140,.13);
  animation: ring-rotate-reverse 53s linear infinite;
}

.song-ring.three {
  inset: 27%;
  transform: rotate(-25deg) scaleY(.76);
  animation: ring-rotate 42s linear infinite;
}

.song-ring.four {
  inset: 39%;
  border-color: rgba(238,233,223,.12);
  animation: ring-rotate-reverse 31s linear infinite;
}

/* -------------------------------------------------- */
/* ARTWORK */
/* -------------------------------------------------- */

.song-art {
  position: relative;
  z-index: 4;

  width: min(270px,38vw);
  aspect-ratio: 1;

  object-fit: cover;
  border-radius: 50%;

  background: #d9d4c8;

  box-shadow:
    0 0 50px rgba(230,223,208,.1),
    0 0 150px rgba(203,183,140,.08);

  animation:
    song-breathe 6s ease-in-out infinite,
    artwork-drift 11s ease-in-out infinite alternate;
}

.song-art-fallback {
  position: relative;
  z-index: 4;

  width: min(270px,38vw);
  aspect-ratio: 1;

  border-radius: 50%;

  background:
    radial-gradient(
      circle at 30% 28%,
      #eee9df,
      transparent 4%
    ),
    #cfc9bb;

  box-shadow:
    0 0 50px rgba(230,223,208,.1);

  animation:
    song-breathe 6s ease-in-out infinite,
    artwork-drift 11s ease-in-out infinite alternate;
}

/* -------------------------------------------------- */
/* ZODIAC */
/* -------------------------------------------------- */

.song-zodiac {
  position: absolute;
  inset: 0;
  z-index: 3;

  animation:
    song-orbit 70s linear infinite,
    zodiac-breathe 12s ease-in-out infinite alternate;
}

.song-zodiac span {
  position: absolute;
  left: 50%;
  top: 50%;

  color: #686b65;
  font-family: "Times New Roman",Georgia,serif;
  font-size: 18px;

  transition:
    color .4s ease,
    text-shadow .4s ease;
}

.song-zodiac span:nth-child(1) {
  transform: translate(-50%,-50%) rotate(0deg) translateY(-47%) rotate(0deg);
}

.song-zodiac span:nth-child(2) {
  transform: translate(-50%,-50%) rotate(30deg) translateY(-47%) rotate(-30deg);
}

.song-zodiac span:nth-child(3) {
  transform: translate(-50%,-50%) rotate(60deg) translateY(-47%) rotate(-60deg);
}

.song-zodiac span:nth-child(4) {
  transform: translate(-50%,-50%) rotate(90deg) translateY(-47%) rotate(-90deg);
}

.song-zodiac span:nth-child(5) {
  transform: translate(-50%,-50%) rotate(120deg) translateY(-47%) rotate(-120deg);
}

.song-zodiac span:nth-child(6) {
  transform: translate(-50%,-50%) rotate(150deg) translateY(-47%) rotate(-150deg);
}

.song-zodiac span:nth-child(7) {
  transform: translate(-50%,-50%) rotate(180deg) translateY(-47%) rotate(-180deg);
}

.song-zodiac span:nth-child(8) {
  transform: translate(-50%,-50%) rotate(210deg) translateY(-47%) rotate(-210deg);
}

.song-zodiac span:nth-child(9) {
  transform: translate(-50%,-50%) rotate(240deg) translateY(-47%) rotate(-240deg);
}

.song-zodiac span:nth-child(10) {
  transform: translate(-50%,-50%) rotate(270deg) translateY(-47%) rotate(-270deg);
}

.song-zodiac span:nth-child(11) {
  transform: translate(-50%,-50%) rotate(300deg) translateY(-47%) rotate(-300deg);
}

.song-zodiac span:nth-child(12) {
  transform: translate(-50%,-50%) rotate(330deg) translateY(-47%) rotate(-330deg);
}

.song-status {
  position: absolute;
  right: 4%;
  bottom: 11%;

  color: #464944;
  font-size: 8px;
  letter-spacing: .16em;

  animation:
    status-float 8s ease-in-out infinite alternate,
    status-pulse 4s ease-in-out infinite;
}

/* -------------------------------------------------- */
/* UNIVERSE */
/* -------------------------------------------------- */

.song-universe {
  position: relative;
  z-index: 4;

  width: min(1360px, calc(100% - 64px));
  margin: 0 auto;
  padding: 8vh 0 18vh;
  opacity: 0;
  transform: translate3d(0, 34px, 0);
  transition:
    opacity .9s cubic-bezier(.2,.8,.2,1),
    transform 1s cubic-bezier(.2,.8,.2,1);
  scroll-margin-top: 24px;
}

.song-universe.is-visible {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.song-universe-header {
  position: relative;
  z-index: 3;
  margin-bottom: 54px;
  text-align: center;
}

.song-universe-eyebrow {
  display: block;
  color: var(--gold);
  font-size: 8px;
  letter-spacing: .28em;
  margin-bottom: 14px;
}

.song-universe-title {
  margin: 0;
  color: var(--ink);
  font-size: clamp(3rem, 6vw, 6rem);
  line-height: .85;
  letter-spacing: -.045em;
}

.song-universe-subtitle {
  margin: 18px auto 0;
  max-width: 520px;
  color: #555852;
  font-size: 9px;
  line-height: 1.8;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.journey-strip {
  position: relative;
  z-index: 3;
  margin: 0 auto 44px;
  padding: 18px 20px;
  border: 1px solid rgba(238,233,223,.06);
  background: rgba(8,9,9,.42);
  overflow: hidden;
  animation: journey-arrival .9s cubic-bezier(.2,.8,.2,1) both;
}

.journey-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 14px;
}

.journey-label {
  color: var(--gold);
  font-size: 8px;
  letter-spacing: .24em;
  text-transform: uppercase;
}

.journey-clear {
  border: 0;
  padding: 0;
  background: transparent;
  color: #555852;
  font: inherit;
  font-size: 7px;
  letter-spacing: .16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color .25s ease;
}

.journey-clear:hover {
  color: #aaa99f;
}

.journey-path {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: thin;
  padding-bottom: 3px;
}

.journey-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  max-width: 210px;
  color: #aaa99f;
  text-decoration: none;
  transition: color .25s ease, transform .3s ease;
}

.journey-item:hover {
  color: var(--ink);
  transform: translateY(-1px);
}

.journey-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border: 1px solid rgba(203,183,140,.55);
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(203,183,140,.08);
}

.journey-item.current .journey-dot {
  background: var(--gold);
}

.journey-item-copy {
  min-width: 0;
}

.journey-item-title {
  overflow: hidden;
  color: inherit;
  font-size: 10px;
  line-height: 1.25;
  letter-spacing: .06em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.journey-item-artist {
  overflow: hidden;
  color: #666961;
  font-family: var(--font-cormorant), Georgia, serif;
  font-size: 11px;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.journey-arrow {
  flex: 0 0 auto;
  color: #41443f;
  font-size: 10px;
}

@keyframes journey-arrival {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.universe-graph-content {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translate3d(0, 10px, 0) scale(.992);
}

.song-universe-stage.is-resolved .universe-graph-content {
  animation: universe-materialize 1.05s cubic-bezier(.2,.8,.2,1) forwards;
}

.universe-empty {
  animation: universe-status-fade .8s ease both;
}

@keyframes universe-materialize {
  0% {
    opacity: 0;
    transform: translate3d(0, 10px, 0) scale(.992);
    filter: blur(2px);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@keyframes universe-status-fade {
  0% {
    opacity: 0;
  }

  100% {
    opacity: 1;
  }
}

.song-universe-stage {
  position: relative;
  width: 100%;
  min-height: 660px;
  overflow: hidden;
  contain: layout paint;

  border-top: 1px solid rgba(238,233,223,.035);
  border-bottom: 1px solid rgba(238,233,223,.035);

  background:
    radial-gradient(
      circle at 50% 50%,
      rgba(203,183,140,.055),
      transparent 28%
    );
}

.song-universe-stage::before,
.song-universe-stage::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  border: 1px solid rgba(238,233,223,.035);
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%,-50%);
}

.song-universe-stage::before {
  width: 430px;
  height: 430px;
  animation: universe-orbit 80s linear infinite;
}

.song-universe-stage::after {
  width: 720px;
  height: 720px;
  border-color: rgba(203,183,140,.018);
  animation: universe-orbit-reverse 110s linear infinite;
}

.universe-chart {
  position: absolute;
  inset: 0;
}

.universe-line {
  stroke: rgba(203,183,140,.16);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 3 9;
  animation: line-shimmer 6s ease-in-out infinite;
}

.universe-line.is-selected {
  stroke: rgba(203,183,140,.65);
  stroke-width: 1.5;
  filter: drop-shadow(0 0 5px rgba(203,183,140,.18));
}

.universe-line.secondary {
  stroke: rgba(238,233,223,.07);
  stroke-dasharray: 1 11;
}

.universe-connection-detail {
  position: absolute;
  left: 50%;
  bottom: 30px;
  z-index: 8;
  width: min(420px, calc(100% - 40px));
  transform: translateX(-50%);
  padding: 14px 18px;
  border: 1px solid rgba(203,183,140,.16);
  background: rgba(8,9,9,.78);
  backdrop-filter: blur(14px);
  text-align: center;
  pointer-events: none;
  animation: connection-detail-in .35s ease both;
}

.universe-connection-detail-label {
  color: var(--gold);
  font-size: 7px;
  letter-spacing: .22em;
  text-transform: uppercase;
}

.universe-connection-detail-text {
  margin-top: 7px;
  color: #aaa99f;
  font-size: 10px;
  line-height: 1.5;
  letter-spacing: .04em;
}

.universe-node-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: opacity .25s ease, transform .25s ease;
}

.universe-node.is-dimmed { opacity: .34; }
.universe-node.is-selected .universe-node-dot {
  border-color: var(--gold);
  background: var(--gold);
  box-shadow: 0 0 28px rgba(203,183,140,.35);
}

.universe-node.is-selected .universe-node-label { color: var(--ink); }

.universe-node-similarity {
  color: var(--gold);
  font-size: 7px;
  letter-spacing: .15em;
}

@keyframes connection-detail-in {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.universe-node {
  position: absolute;
  transform: translate(-50%,-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  min-width: 100px;
  max-width: 170px;
  text-align: center;

  animation:
    universe-node-float 8s ease-in-out infinite alternate;
}

.universe-node-dot {
  width: 8px;
  height: 8px;
  border: 1px solid rgba(238,233,223,.5);
  border-radius: 50%;
  background: #080909;
  box-shadow: 0 0 18px rgba(203,183,140,.08);
}

.universe-node-label {
  color: #aaa99f;
  font-size: 12px;
  line-height: 1.35;
  letter-spacing: .08em;
  font-weight: 500;
  max-width: 190px;
  text-wrap: balance;
  text-transform: uppercase;
}

.universe-node-type {
  color: #41443f;
  font-size: 6px;
  letter-spacing: .2em;
  text-transform: uppercase;
}

.universe-node.song {
  min-width: 130px;
  max-width: 190px;
  cursor: pointer;
}

.universe-node.song .universe-node-dot {
  width: 10px;
  height: 10px;
  border-color: rgba(203,183,140,.62);
}

.universe-node-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  color: inherit;
  text-decoration: none;
}

.universe-node-artist {
  color: #85877f;
  font-family: var(--font-cormorant), Georgia, serif;
  font-size: 14px;
  line-height: 1.1;
}

.universe-node-genres {
  color: #666961;
  font-size: 9px;
  letter-spacing: .11em;
  line-height: 1.4;
  text-transform: uppercase;
}

.universe-node.song:hover .universe-node-dot {
  border-color: var(--gold);
  box-shadow: 0 0 22px rgba(203,183,140,.18);
}

.universe-node.song:hover .universe-node-label {
  color: var(--ink);
}

.universe-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%,-50%);
  z-index: 5;

  width: 170px;
  height: 170px;

  display: grid;
  place-items: center;

  border: 1px solid rgba(203,183,140,.32);
  border-radius: 50%;

  background:
    radial-gradient(
      circle,
      rgba(203,183,140,.09),
      rgba(8,9,9,.92) 68%
    );

  box-shadow:
    0 0 70px rgba(203,183,140,.07),
    inset 0 0 45px rgba(203,183,140,.035);

  animation:
    center-breathe 7s ease-in-out infinite,
    center-rotate 40s linear infinite;
}

.universe-center::before {
  content: "";
  position: absolute;
  inset: 14px;
  border: 1px solid rgba(238,233,223,.06);
  border-radius: 50%;
}

.universe-center-inner {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 20px;
}

.universe-center-label {
  color: var(--gold);
  font-size: 6px;
  letter-spacing: .24em;
  text-transform: uppercase;
}

.universe-center-title {
  margin-top: 9px;
  color: var(--ink);
  font-family: var(--font-cormorant), Georgia, serif;
  font-size: 23px;
  line-height: .9;
  letter-spacing: -.025em;
}

.universe-center-artist {
  margin-top: 8px;
  color: #686b65;
  font-size: 7px;
  letter-spacing: .12em;
  text-transform: uppercase;
}




.universe-empty {
  min-height: 420px;
  display: grid;
  place-items: center;
  color: #464944;
  font-size: 8px;
  letter-spacing: .18em;
  text-transform: uppercase;
}

.universe-source {
  margin-top: 22px;
  color: #353833;
  text-align: center;
  font-size: 6px;
  letter-spacing: .2em;
  text-transform: uppercase;
}

/* -------------------------------------------------- */
/* ANIMATIONS */
/* -------------------------------------------------- */

@keyframes background-circle {
  from {
    transform: translate(-50%,-50%) rotate(0deg);
  }

  to {
    transform: translate(-50%,-50%) rotate(360deg);
  }
}

@keyframes background-circle-reverse {
  from {
    transform: translate(-50%,-50%) rotate(360deg);
  }

  to {
    transform: translate(-50%,-50%) rotate(0deg);
  }
}

@keyframes stars-field-drift {
  from {
    transform: translate3d(-5px,-3px,0) scale(1);
  }

  to {
    transform: translate3d(6px,5px,0) scale(1.012);
  }
}

@keyframes star-micro-drift {
  from {
    transform: translate3d(0,0,0);
  }

  to {
    transform: translate3d(5px,-4px,0);
  }
}

@keyframes song-twinkle {
  0%,100% {
    opacity: .16;
  }

  50% {
    opacity: .75;
  }
}

@keyframes nav-mark-breathe {
  0%,100% {
    opacity: .65;
  }

  50% {
    opacity: 1;
  }
}

@keyframes song-copy-arrival {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes art-field-arrival {
  from {
    opacity: 0;
    transform: scale(.94);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes player-arrival {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes eyebrow-drift {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(4px);
  }
}

@keyframes title-float {
  from {
    transform: translate3d(0,0,0);
  }

  to {
    transform: translate3d(5px,-5px,0);
  }
}

@keyframes title-opacity {
  0%,100% {
    opacity: .93;
  }

  50% {
    opacity: 1;
  }
}

@keyframes artist-float {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(7px);
  }
}

@keyframes album-drift {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(4px);
  }
}

@keyframes progress-star {
  0%,100% {
    opacity: .25;
    transform: translateX(-2px) scale(.8);
  }

  50% {
    opacity: .8;
    transform: translateX(2px) scale(1.2);
  }
}

@keyframes note-pulse {
  0%,100% {
    opacity: .45;
  }

  50% {
    opacity: .85;
  }
}

@keyframes art-field-float {
  from {
    transform: translate3d(0,0,0);
  }

  to {
    transform: translate3d(5px,-7px,0);
  }
}

@keyframes song-breathe {
  0%,100% {
    transform: scale(.985);
  }

  50% {
    transform: scale(1.018);
  }
}

@keyframes artwork-drift {
  from {
    margin-top: 0;
  }

  to {
    margin-top: -5px;
  }
}

@keyframes glow-pulse {
  0%,100% {
    opacity: .65;
    transform: scale(.97);
  }

  50% {
    opacity: 1;
    transform: scale(1.035);
  }
}

@keyframes ring-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes ring-rotate-reverse {
  from {
    transform: rotate(360deg);
  }

  to {
    transform: rotate(0deg);
  }
}

@keyframes song-orbit {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes zodiac-breathe {
  from {
    opacity: .72;
  }

  to {
    opacity: 1;
  }
}

@keyframes status-float {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(-5px);
  }
}

@keyframes status-pulse {
  0%,100% {
    opacity: .4;
  }

  50% {
    opacity: .8;
  }
}

@keyframes universe-arrival {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes universe-orbit {
  from {
    transform: translate(-50%,-50%) rotate(0deg);
  }

  to {
    transform: translate(-50%,-50%) rotate(360deg);
  }
}

@keyframes universe-orbit-reverse {
  from {
    transform: translate(-50%,-50%) rotate(360deg);
  }

  to {
    transform: translate(-50%,-50%) rotate(0deg);
  }
}

@keyframes universe-node-float {
  from {
    transform: translate(-50%,-50%) translate3d(0,0,0);
  }

  to {
    transform: translate(-50%,-50%) translate3d(4px,-6px,0);
  }
}

@keyframes center-breathe {
  0%,100% {
    transform: translate(-50%,-50%) scale(.985);
  }

  50% {
    transform: translate(-50%,-50%) scale(1.02);
  }
}

@keyframes center-rotate {
  from {
    box-shadow:
      0 0 70px rgba(203,183,140,.07),
      inset 0 0 45px rgba(203,183,140,.035);
  }

  50% {
    box-shadow:
      0 0 95px rgba(203,183,140,.1),
      inset 0 0 60px rgba(203,183,140,.05);
  }

  to {
    box-shadow:
      0 0 70px rgba(203,183,140,.07),
      inset 0 0 45px rgba(203,183,140,.035);
  }
}

@keyframes line-shimmer {
  0%,100% {
    opacity: .45;
  }

  50% {
    opacity: 1;
  }
}

/* -------------------------------------------------- */
/* RESPONSIVE */
/* -------------------------------------------------- */

@media(max-width:900px) {
  .song-nav,
  .song-stage,
  .song-universe {
    width: min(100% - 36px,720px);
  }

  .song-stage {
    grid-template-columns: 1fr;
    gap: 0;
    padding-top: 7vh;
  }

  .song-copy {
    padding-bottom: 3vh;
  }

  .song-art-field {
    width: min(680px,100vw);
    justify-self: center;
  }

  .song-status {
    bottom: 4%;
  }

  .song-universe {
    padding-top: 7vh;
  }

  .song-universe-stage {
    min-height: 600px;
  }
}

@media(max-width:620px) {
  .journey-strip {
    margin-bottom: 30px;
    padding: 15px 14px;
  }

  .journey-item-title {
    font-size: 9px;
  }

  .journey-item-artist {
    font-size: 10px;
  }


  .song-nav {
    height: 72px;
  }

  .song-stage {
    width: calc(100% - 36px);
  }

  .song-title {
    font-size: 4.5rem;
  }

  .song-art {
    width: 55vw;
  }

  .song-art-fallback {
    width: 55vw;
  }

  .song-art-field {
    width: 110vw;
    margin-left: -5vw;
  }

  .song-universe {
    width: calc(100% - 36px);
  }

  .song-universe-stage {
    min-height: 520px;
  }

  .song-universe-title {
    font-size: 3.8rem;
  }

  .universe-center {
    width: 130px;
    height: 130px;
  }

  .universe-center-title {
    font-size: 18px;
  }

  .universe-node {
    min-width: 82px;
    max-width: 120px;
  }

  .universe-node-label {
    font-size: 10px;
    letter-spacing: .07em;
  }

  .universe-node-artist {
    font-size: 12px;
  }

  .universe-node-genres {
    font-size: 8px;
  }

  .universe-node-type {
    font-size: 7px;
  }

  .song-universe-stage::before {
    width: 300px;
    height: 300px;
  }

  .song-universe-stage::after {
    width: 480px;
    height: 480px;
  }

  .universe-legend {
    left: 14px;
    bottom: 14px;
    gap: 10px;
  }
}

@media(prefers-reduced-motion:reduce) {
  .song-page *,
  .song-page *::before,
  .song-page *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
  }

  .song-universe {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
`;

function getGraphPoints(
  nodes: UniverseNode[],
  centerId: string
): GraphPoint[] {
  const satellites = nodes
    .filter((node) => node.id !== centerId)
    .filter((node) => node.type === "song")
    .slice(0, 8);

  const positions = [
    { x: 50, y: 15 },
    { x: 76, y: 27 },
    { x: 88, y: 50 },
    { x: 76, y: 73 },
    { x: 50, y: 85 },
    { x: 24, y: 73 },
    { x: 12, y: 50 },
    { x: 24, y: 27 },
  ];

  return satellites.map((node, index) => ({
    node,
    x: positions[index].x,
    y: positions[index].y,
  }));
}

async function searchAppleDirectPreview(title: string, artist: string) {
  if (typeof document === "undefined") return null;

  return new Promise<{
    previewUrl: string;
    artworkUrl: string | null;
    albumName: string | null;
    trackId: string;
  } | null>((resolve) => {
    const callbackName = `__vesperPlayback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const params = new URLSearchParams({
      term: `${title} ${artist}`,
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

    const finish = (value: {
      previewUrl: string;
      artworkUrl: string | null;
      albumName: string | null;
      trackId: string;
    } | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const timeout = window.setTimeout(() => finish(null), 10000);

    (window as unknown as Record<string, unknown>)[callbackName] = (
      data: { results?: unknown[] }
    ) => {
      const normalized = (value: string) =>
        value
          .normalize("NFKD")
          .replace(/[\\u0300-\\u036f]/g, "")
          .toLowerCase()
          .replace(/\\b(feat\\.?|ft\\.?)\\b.*$/i, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .replace(/\\s+/g, " ");

      const wantedTitle = normalized(title);
      const wantedArtist = normalized(artist);
      const results = Array.isArray(data?.results) ? data.results : [];
      const candidates = results.filter(
        (result): result is Record<string, unknown> =>
          Boolean(result) && typeof result === "object"
      );

      const exact = candidates.find((result) =>
        typeof result.trackName === "string" &&
        typeof result.artistName === "string" &&
        typeof result.previewUrl === "string" &&
        normalized(result.trackName) === wantedTitle &&
        normalized(result.artistName) === wantedArtist
      );

      const titleMatch = candidates.find((result) =>
        typeof result.trackName === "string" &&
        typeof result.previewUrl === "string" &&
        normalized(result.trackName) === wantedTitle
      );

      const match = exact ?? titleMatch;

      if (!match || typeof match.previewUrl !== "string" || !match.previewUrl) {
        finish(null);
        return;
      }

      finish({
        previewUrl: match.previewUrl,
        artworkUrl:
          typeof match.artworkUrl100 === "string"
            ? match.artworkUrl100.replace("100x100", "600x600")
            : null,
        albumName:
          typeof match.collectionName === "string"
            ? match.collectionName
            : null,
        trackId:
          typeof match.trackId === "number" ? String(match.trackId) : "",
      });
    };

    script.async = true;
    script.src = `https://itunes.apple.com/search?${params.toString()}`;
    script.onerror = () => finish(null);
    document.head.appendChild(script);
  });
}

export default function SongPage() {
  const params = useParams<{
    trackId: string;
  }>();

  const searchParams = useSearchParams();

  const {
    song: activeSong,
    playing,
    currentTime,
    duration,
    autoplayBlocked,
    setSong,
    togglePlayback,
    ready: musicReady,
  } = useMusic();

  const [universe, setUniverse] =
    useState<UniverseData | null>(null);

  const [journey, setJourney] = useState<JourneyItem[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const universeRef = useRef<HTMLElement | null>(null);
  const [universeVisible, setUniverseVisible] =
    useState(false);

  const song = useMemo(
    () => ({
      id: params.trackId,
      title:
        searchParams.get("title") ??
        "Unknown signal",
      artist:
        searchParams.get("artist") ??
        "Unknown artist",
      album: searchParams.get("album"),
      artwork: searchParams.get("artwork"),
      preview: searchParams.get("preview"),
      playback: searchParams.get("playback"),
      source: searchParams.get("source"),
      playbackId: searchParams.get("playbackId"),
      sourceUrl: searchParams.get("sourceUrl"),
    }),
    [params.trackId, searchParams]
  );

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(JOURNEY_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return;

      const valid = parsed.filter(
        (item): item is JourneyItem =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as JourneyItem).id === "string" &&
          typeof (item as JourneyItem).title === "string" &&
          typeof (item as JourneyItem).artist === "string"
      );

      setJourney(valid.slice(-MAX_JOURNEY_LENGTH));
    } catch {
      setJourney([]);
    }
  }, []);

  useEffect(() => {
    const item: JourneyItem = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      artwork: song.artwork,
      preview: song.preview,
    };

    setJourney((current) => {
      const withoutCurrent = current.filter((entry) => entry.id !== item.id);
      const next = [...withoutCurrent, item].slice(-MAX_JOURNEY_LENGTH);

      try {
        window.sessionStorage.setItem(
          JOURNEY_STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch {
        // Session storage can be unavailable in private or restricted contexts.
      }

      return next;
    });
  }, [song.album, song.artist, song.artwork, song.id, song.preview, song.title]);

  const clearJourney = () => {
    setJourney([]);
    try {
      window.sessionStorage.removeItem(JOURNEY_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  };

  const resolvedPlaybackUrl =
    song.playback ??
    song.preview ??
    (activeSong?.id === song.id ? activeSong.audioUrl : null);

  const hasPlayableSignal = Boolean(resolvedPlaybackUrl);

  const onlineSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `"${song.title}" "${song.artist}" song`
  )}`;

  useEffect(() => {
    let cancelled = false;

    async function preparePlayback() {
      if (!musicReady) return;

      let playbackUrl = song.playback ?? song.preview ?? null;
      let playbackSource: "soundcloud" | "itunes" | "local" =
        song.source === "soundcloud" ? "soundcloud" : "itunes";
      let playbackSourceUrl = song.sourceUrl ?? null;
      let artwork = song.artwork;
      let album = song.album;

      if (!playbackUrl) {
        try {
          const response = await fetch(
            `/api/music/song-search?q=${encodeURIComponent(`${song.title} ${song.artist}`)}`,
            { cache: "no-store" }
          );

          if (response.ok) {
            const data = (await response.json()) as {
              songs?: Array<{
                title: string;
                artistName: string;
                albumName: string | null;
                artworkUrl: string | null;
                previewUrl: string | null;
                playback?: {
                  provider?: "soundcloud" | "itunes" | "local";
                  url?: string | null;
                  sourceUrl?: string | null;
                };
              }>;
              results?: Array<{
                title: string;
                artistName: string;
                albumName: string | null;
                artworkUrl: string | null;
                previewUrl: string | null;
                playback?: {
                  provider?: "soundcloud" | "itunes" | "local";
                  url?: string | null;
                  sourceUrl?: string | null;
                };
              }>;
            };

            const candidates = Array.isArray(data.songs)
              ? data.songs
              : Array.isArray(data.results)
                ? data.results
                : [];

            const normalized = (value: string) =>
              value
                .normalize("NFKD")
                .replace(/[\\u0300-\\u036f]/g, "")
                .toLowerCase()
                .replace(/\\b(feat\\.?|ft\\.?)\\b.*$/i, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
                .replace(/\\s+/g, " ");

            const titleKey = normalized(song.title);
            const artistKey = normalized(song.artist);
            const match = candidates.find(
              (candidate) =>
                normalized(candidate.title) === titleKey &&
                normalized(candidate.artistName) === artistKey &&
                Boolean(candidate.playback?.url ?? candidate.previewUrl)
            ) ?? candidates.find(
              (candidate) =>
                normalized(candidate.title) === titleKey &&
                Boolean(candidate.playback?.url ?? candidate.previewUrl)
            );

            if (match) {
              playbackUrl = match.playback?.url ?? match.previewUrl ?? null;
              playbackSource =
                match.playback?.provider === "soundcloud"
                  ? "soundcloud"
                  : match.playback?.provider === "local"
                    ? "local"
                    : "itunes";
              playbackSourceUrl = match.playback?.sourceUrl ?? null;
              artwork = match.artworkUrl ?? artwork;
              album = match.albumName ?? album;
            }
          }
        } catch (error) {
          console.warn("Vesper playback catalog lookup failed:", error);
        }
      }

      // Last.fm is discovery metadata, not an audio host. If discovery found
      // the song but the server could not obtain an Apple preview, use the
      // browser-side Apple catalog path that can still return a preview for
      // this exact song when the server path is being refused.
      if (!playbackUrl) {
        const apple = await searchAppleDirectPreview(song.title, song.artist);
        if (apple) {
          playbackUrl = apple.previewUrl;
          playbackSource = "itunes";
          playbackSourceUrl = null;
          artwork = apple.artworkUrl ?? artwork;
          album = apple.albumName ?? album;
        }
      }

      if (cancelled || !playbackUrl) return;

      if (
        activeSong?.id === song.id &&
        activeSong.audioUrl === playbackUrl
      ) {
        return;
      }

      setSong({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album,
        artwork,
        audioUrl: playbackUrl,
        source: playbackSource,
        sourceUrl: playbackSourceUrl,
      });
    }

    preparePlayback();

    return () => {
      cancelled = true;
    };
  }, [
    activeSong?.audioUrl,
    activeSong?.id,
    musicReady,
    setSong,
    song.album,
    song.artist,
    song.artwork,
    song.id,
    song.playback,
    song.preview,
    song.source,
    song.sourceUrl,
    song.title,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function resolveUniverse() {
      if (!cancelled) {
        setSelectedNodeId(null);
        // A new song should always get a fresh universe. Do not leave the
        // previous song's graph visible while the next universe resolves.
        setUniverse(null);
      }

      try {
        const query = new URLSearchParams({
          title: song.title,
          artist: song.artist,
          // Force a fresh client request whenever a graph node becomes the
          // new center of the universe.
          _vesperRefresh: String(Date.now()),
        });

        if (song.album) {
          query.set("album", song.album);
        }

        const requestUniverse = async (attempt: number) => {
          query.set(
            "_vesperRefresh",
            `${Date.now()}-${attempt}`
          );

          return fetch(
            `/api/music/song/${encodeURIComponent(
              song.id
            )}?${query.toString()}`,
            { cache: "no-store" }
          );
        };

        let response = await requestUniverse(0);

        if (!response.ok) {
          throw new Error(
            `Universe request failed with ${response.status}`
          );
        }

        let data =
          (await response.json()) as UniverseData;

        // A newly clicked node can race a cold upstream MusicBrainz/Last.fm
        // lookup. If the first fresh response resolves to no satellite nodes,
        // retry once with a completely new cache key before showing an empty
        // universe. This keeps navigation deterministic without requiring a
        // manual browser refresh.
        const hasSatelliteNodes =
          (data.graph?.nodes ?? []).some(
            (node) =>
              node.type === "song" &&
              node.id !== data.graph?.center?.id
          );

        if (!hasSatelliteNodes) {
          const retryResponse = await requestUniverse(1);
          if (retryResponse.ok) {
            const retryData =
              (await retryResponse.json()) as UniverseData;
            const retryHasSatelliteNodes =
              (retryData.graph?.nodes ?? []).some(
                (node) =>
                  node.type === "song" &&
                  node.id !== retryData.graph?.center?.id
              );

            if (retryHasSatelliteNodes) {
              data = retryData;
            }
          }
        }

        if (!cancelled) {
          setUniverse(data);
        }
      } catch (error) {
        console.error(
          "Unable to resolve song universe:",
          error
        );

        if (!cancelled) {
          setUniverse(null);
        }
      }
    }

    resolveUniverse();

    return () => {
      cancelled = true;
    };
  }, [
    song.album,
    song.artist,
    song.id,
    song.title,
  ]);

  useEffect(() => {
    const element = universeRef.current;
    if (!element) return;

    let fallbackTimer: number | null = null;

    const reveal = () => {
      setUniverseVisible(true);
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.01,
      }
    );

    observer.observe(element);

    // Never let the visual reveal depend entirely on an observer firing.
    fallbackTimer = window.setTimeout(reveal, 900);

    return () => {
      observer.disconnect();
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, []);

  const isActive =
    activeSong?.id === song.id;

  const progress = duration
    ? (currentTime / duration) * 100
    : 0;

  const formatTime = (value: number) =>
    `${Math.floor(value / 60)
      .toString()
      .padStart(2, "0")} : ${Math.floor(
      value % 60
    )
      .toString()
      .padStart(2, "0")}`;

  const graphPoints =
    universe?.graph?.nodes?.length
      ? getGraphPoints(
          universe.graph.nodes,
          universe.graph.center?.id ?? song.id
        )
      : [];

  const centerId =
    universe?.graph?.center?.id ?? song.id;

  const visibleEdges =
    universe?.graph?.edges?.filter(
      (edge) =>
        edge.source === centerId ||
        edge.target === centerId
    ) ?? [];

  const selectedNode = selectedNodeId
    ? universe?.graph?.nodes?.find((node) => node.id === selectedNodeId) ?? null
    : null;

  const selectedEdge = selectedNodeId
    ? visibleEdges.find(
        (edge) => edge.source === selectedNodeId || edge.target === selectedNodeId
      ) ?? null
    : null;

  return (
    <>
      <style>{songStyles}</style>

      <main className="song-page">
        <div className="song-stars">
          {Array.from({ length: 60 }).map(
            (_, i) => (
              <span
                key={i}
                style={{
                  left: `${(i * 41.7) % 100}%`,
                  top: `${(i * 67.3) % 100}%`,
                  animationDelay: `-${(
                    (i % 7) *
                    0.55
                  ).toFixed(2)}s`,
                }}
              />
            )
          )}
        </div>

        <nav className="song-nav">
          <Link
            href="/"
            className="song-back"
          >
            ← RETURN TO VESPER
          </Link>

          <span className="song-nav-mark">
            THE SIGNAL
          </span>
        </nav>

        <section className="song-stage">
          <div className="song-copy">
            <span className="song-eyebrow">
              01 / THE SIGNAL
            </span>

            <h1 className="song-title">
              {song.title}
            </h1>

            <div className="song-artist">
              {song.artist}
            </div>

            {song.album && (
              <div className="song-album">
                {song.album}
              </div>
            )}

            <div className="song-player">
              <div className="song-progress">
                <div
                  className="song-progress-fill"
                  style={{
                    width: `${
                      isActive
                        ? progress
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="song-player-row">
                <button
                  type="button"
                  className="song-play"
                  onClick={togglePlayback}
                  disabled={
                    !hasPlayableSignal ||
                    !isActive
                  }
                  aria-label={
                    playing
                      ? "Pause"
                      : "Play"
                  }
                >
                  {playing && isActive
                    ? "Ⅱ"
                    : "▶"}
                </button>

                <span className="song-time">
                  {formatTime(
                    isActive
                      ? currentTime
                      : 0
                  )}{" "}
                  /{" "}
                  {formatTime(
                    isActive
                      ? duration
                      : 0
                  )}
                </span>
              </div>

              <div className="song-note">
                {!hasPlayableSignal
                  ? "APPLE PREVIEW UNAVAILABLE FOR THIS SIGNAL"
                  : !isActive
                    ? "PREPARING THE SIGNAL"
                    : autoplayBlocked
                      ? "PRESS PLAY TO ENTER THE SIGNAL"
                      : "PLAYING A 30 SECOND SIGNAL"}
              </div>

              {!hasPlayableSignal && (
                <div className="song-upload-note">
                  <strong>
                    Vesper could not find a playable preview.
                  </strong>
                  <br />
                  The song may still exist elsewhere online.
                  <br />
                  <a
                    className="song-search-online"
                    href={onlineSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    SEARCH THIS SONG ONLINE ↗
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="song-art-field">
            <div className="song-glow" />

            <div className="song-ring one" />
            <div className="song-ring two" />
            <div className="song-ring three" />
            <div className="song-ring four" />

            <div className="song-zodiac">
              {zodiacSigns.map((glyph) => (
                <span key={glyph}>
                  {glyph}
                </span>
              ))}
            </div>

            {song.artwork ? (
              <img
                className="song-art"
                src={song.artwork}
                alt=""
              />
            ) : (
              <div className="song-art-fallback" />
            )}

            <div className="song-status">
              {hasPlayableSignal
                ? universe?.matched
                  ? "SIGNAL ACTIVE · UNIVERSE RESOLVED"
                  : "SIGNAL ACTIVE"
                : universe?.matched
                  ? "SIGNAL FOUND · UNIVERSE RESOLVED"
                  : "SIGNAL FOUND · AUDIO UNAVAILABLE"}
            </div>
          </div>
        </section>

        <section
          ref={universeRef}
          className={`song-universe ${
            universeVisible ? "is-visible" : ""
          }`}
        >
          <header className="song-universe-header">
            <span className="song-universe-eyebrow">
              02 / THE UNIVERSE
            </span>

            <h2 className="song-universe-title">
              Everything around the signal.
            </h2>

            <p className="song-universe-subtitle">
              The song is the center. Every point around it
              is another song sharing its musical language.
            </p>
          </header>

          {journey.length > 0 && (
            <div className="journey-strip" aria-label="Your Vesper journey">
              <div className="journey-heading">
                <span className="journey-label">YOUR PATH</span>
                {journey.length > 1 && (
                  <button
                    type="button"
                    className="journey-clear"
                    onClick={clearJourney}
                  >
                    CLEAR PATH
                  </button>
                )}
              </div>

              <div className="journey-path">
                {journey.map((item, index) => {
                  const itemParams = new URLSearchParams({
                    title: item.title,
                    artist: item.artist,
                  });

                  if (item.album) itemParams.set("album", item.album);
                  if (item.artwork) itemParams.set("artwork", item.artwork);
                  if (item.preview) itemParams.set("preview", item.preview);

                  const itemHref = `/song/${encodeURIComponent(item.id)}?${itemParams.toString()}`;
                  const isCurrent = item.id === song.id;

                  return (
                    <Fragment key={`${item.id}-${index}`}>
                      {index > 0 && <span className="journey-arrow" aria-hidden="true">→</span>}
                      <Link
                        href={itemHref}
                        className={`journey-item ${isCurrent ? "current" : ""}`}
                        aria-current={isCurrent ? "page" : undefined}
                      >
                        <span className="journey-dot" />
                        <span className="journey-item-copy">
                          <span className="journey-item-title">{item.title}</span>
                          <span className="journey-item-artist">{item.artist}</span>
                        </span>
                      </Link>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className={`song-universe-stage ${
              universe?.graph?.nodes?.length
                ? "is-resolved"
                : ""
            }`}
          >
            {universe?.graph?.nodes?.length ? (
              <div className="universe-graph-content">
                <svg
                  className="universe-chart"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {graphPoints.map(
                    (point) => {
                      const edge =
                        visibleEdges.find(
                          (candidate) =>
                            candidate.source ===
                              centerId &&
                            candidate.target ===
                              point.node.id
                        ) ??
                        visibleEdges.find(
                          (candidate) =>
                            candidate.target ===
                              centerId &&
                            candidate.source ===
                              point.node.id
                        );

                      if (!edge) {
                        return null;
                      }

                      return (
                        <line
                          key={`${edge.source}-${edge.target}`}
                          className={`universe-line ${selectedNodeId && point.node.id === selectedNodeId ? "is-selected" : ""}`}
                          x1="50"
                          y1="50"
                          x2={point.x}
                          y2={point.y}
                        />
                      );
                    }
                  )}
                </svg>

                <div className="universe-center">
                  <div className="universe-center-inner">
                    <div className="universe-center-label">
                      The signal
                    </div>

                    <div className="universe-center-title">
                      {universe?.song?.title ?? song.title}
                    </div>

                    <div className="universe-center-artist">
                      {song.artist}
                    </div>
                  </div>
                </div>

                {graphPoints.map(
                  (point, index) => {
                    const hrefParams = new URLSearchParams({
                      title: point.node.label,
                      artist: point.node.artist ?? "Unknown artist",
                    });

                    if (point.node.album) {
                      hrefParams.set("album", point.node.album);
                    }
                    if (point.node.artworkUrl) {
                      hrefParams.set("artwork", point.node.artworkUrl);
                    }
                    if (point.node.previewUrl) {
                      hrefParams.set("preview", point.node.previewUrl);
                    }

                    const href = `/song/${encodeURIComponent(
                      point.node.id
                    )}?${hrefParams.toString()}`;

                    return (
                      <div
                        key={`${point.node.type}-${point.node.id}`}
                        className={`universe-node ${point.node.type} ${selectedNodeId && selectedNodeId !== point.node.id ? "is-dimmed" : ""} ${selectedNodeId === point.node.id ? "is-selected" : ""}`}
                        onMouseEnter={() => setSelectedNodeId(point.node.id)}
                        onFocus={() => setSelectedNodeId(point.node.id)}
                        onMouseLeave={() => setSelectedNodeId(null)}
                        style={{
                          left: `${point.x}%`,
                          top: `${point.y}%`,
                          animationDelay: `-${(
                            index * 0.7
                          ).toFixed(2)}s`,
                        }}
                      >
                        <Link
                          href={href}
                          className="universe-node-link"
                          aria-label={`Open ${point.node.label} by ${point.node.artist ?? "Unknown artist"}`}
                        >
                          <div className="universe-node-dot" />

                          <div className="universe-node-label">
                            {point.node.label}
                          </div>

                          <div className="universe-node-artist">
                            {point.node.artist ?? "Unknown artist"}
                          </div>

                          {point.node.genres &&
                            point.node.genres.length > 0 && (
                              <div className="universe-node-genres">
                                {point.node.genres
                                  .slice(0, 2)
                                  .join(" · ")}
                              </div>
                            )}

                          {typeof point.node.lastFmMatch === "number" && (
                            <div className="universe-node-similarity">
                              {Math.round(point.node.lastFmMatch * 100)}% SIMILAR
                            </div>
                          )}
                        </Link>
                      </div>
                    );
                  }
                )}

                {selectedNode && selectedEdge && (
                  <div className="universe-connection-detail" aria-live="polite">
                    <div className="universe-connection-detail-label">
                      WHY THIS SIGNAL
                    </div>
                    <div className="universe-connection-detail-text">
                      {selectedEdge.relationship}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="universe-empty">
                The universe is still forming.
              </div>
            )}
          </div>

          <div className="universe-source">
            {universe?.graph?.nodes?.length
              ? "Music universe resolved through MusicBrainz"
              : "Reading the music universe..."}
          </div>
        </section>
      </main>
    </>
  );
}
