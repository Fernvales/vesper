"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  genres?: string[];
  previewUrl?: string | null;
  artworkUrl?: string | null;
  album?: string | null;
  provider?: string;
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
    reason?: string;
    previewUrl?: string | null;
    artworkUrl?: string | null;
    album?: string | null;
    provider?: string;
    lastFmMatch?: number;
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

type JourneyStop = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  artwork: string | null;
  preview: string | null;
};

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

.universe-line.secondary {
  stroke: rgba(238,233,223,.07);
  stroke-dasharray: 1 11;
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
  text-transform: uppercase;
  font-weight: 500;
  max-width: 190px;
  text-wrap: balance;
  text-transform: uppercase;
}

.universe-node-type {
  color: #696c65;
  font-size: 8px;
  letter-spacing: .16em;
  text-transform: uppercase;
}

.universe-node.song {
  min-width: 130px;
  max-width: 190px;
  cursor: pointer;
}

.universe-node.song .universe-node-dot {
  width: 4px;
  height: 4px;
  border: 0;
  background: #eee9df;
  box-shadow: 0 0 7px rgba(238,233,223,.8), 0 0 15px rgba(203,183,140,.35);
}

.universe-node-star {
  position: relative;
  display: block;
  width: 13px;
  height: 13px;
  transform: rotate(45deg);
  opacity: .9;
  transition: transform .2s ease, filter .2s ease;
}

.universe-node-star::before,
.universe-node-star::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2px;
  height: 13px;
  border-radius: 999px;
  background: #eee9df;
  box-shadow: 0 0 7px rgba(238,233,223,.8);
  transform: translate(-50%, -50%);
}

.universe-node-star::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.universe-node-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.universe-node-artist {
  color: #85877f;
  font-family: var(--font-cormorant), Georgia, serif;
  font-size: 14px;
  line-height: 1;
}

.universe-node-genres {
  color: #666961;
  font-size: 9px;
  letter-spacing: .11em;
  line-height: 1.5;
  text-transform: uppercase;
}

.universe-node.song:hover .universe-node-star,
.universe-node.song.is-selected .universe-node-star {
  transform: rotate(45deg) scale(1.22);
  filter: brightness(1.25);
}

.universe-node.song:hover .universe-node-dot,
.universe-node.song.is-selected .universe-node-dot {
  box-shadow: 0 0 10px rgba(238,233,223,.95), 0 0 22px rgba(203,183,140,.5);
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
    font-size: 6px;
  }

  .universe-node-type {
    font-size: 5px;
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

.journey-strip {
  width: min(1120px, calc(100% - 48px));
  margin: 0 auto 42px;
  padding: 18px 0 0;
  border-top: 1px solid rgba(238,233,223,.08);
  animation: journey-arrival .9s cubic-bezier(.2,.8,.2,1) both;
}

.journey-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 14px;
}

.journey-label {
  color: #aaa99f;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .18em;
  text-transform: uppercase;
}

.journey-clear {
  border: 0;
  background: transparent;
  color: #666961;
  cursor: pointer;
  font: inherit;
  font-size: 9px;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 4px 0;
}

.journey-path {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: thin;
}

.journey-stop {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 7px 11px;
  border: 1px solid rgba(238,233,223,.09);
  border-radius: 999px;
  color: #85877f;
  text-decoration: none;
  transition: border-color .25s ease, color .25s ease, background .25s ease;
}

.journey-stop:hover,
.journey-stop.current {
  border-color: rgba(203,183,140,.38);
  color: var(--ink);
  background: rgba(203,183,140,.045);
}

.journey-stop-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border: 1px solid rgba(203,183,140,.6);
  border-radius: 50%;
}

.journey-stop-copy {
  display: grid;
  gap: 2px;
}

.journey-stop-title {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.1;
}

.journey-stop-artist {
  color: #62655f;
  font-family: var(--font-cormorant), Georgia, serif;
  font-size: 11px;
  line-height: 1;
}

.journey-arrow {
  flex: 0 0 auto;
  color: #454842;
  font-size: 12px;
}

@keyframes journey-arrival {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.journey-strip.is-clearing {
  animation: journey-departure .42s cubic-bezier(.4,0,.8,.2) both;
}

@keyframes journey-departure {
  from {
    opacity: 1;
    transform: translateY(0);
    max-height: 180px;
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
    max-height: 0;
    margin-bottom: 0;
    padding-top: 0;
    border-top-color: transparent;
  }
}

.universe-node-link:focus-visible {
  outline: 1px solid rgba(203,183,140,.55);
  outline-offset: 8px;
  border-radius: 999px;
}

.universe-node.is-dimmed {
  opacity: .32;
}

.universe-node.is-selected .universe-node-dot {
  border-color: var(--gold);
  background: var(--gold);
  box-shadow: 0 0 28px rgba(203,183,140,.38);
}

.universe-node.is-selected .universe-node-label {
  color: var(--ink);
}

.universe-node-similarity {
  color: var(--gold);
  font-size: 7px;
  letter-spacing: .16em;
  line-height: 1;
}

.universe-line.is-selected {
  stroke: rgba(203,183,140,.7);
  stroke-width: 1.7;
  filter: drop-shadow(0 0 5px rgba(203,183,140,.2));
}

.universe-connection-detail {
  position: absolute;
  left: 50%;
  bottom: 28px;
  z-index: 8;
  width: min(430px, calc(100% - 40px));
  transform: translateX(-50%);
  padding: 13px 18px 15px;
  border: 1px solid rgba(203,183,140,.15);
  background: rgba(8,9,9,.84);
  backdrop-filter: blur(14px);
  text-align: center;
  pointer-events: none;
  animation: connection-detail-in .28s ease both;
}

.universe-connection-detail-label {
  color: var(--gold);
  font-size: 7px;
  letter-spacing: .22em;
  text-transform: uppercase;
}

.universe-connection-detail-title {
  margin-top: 6px;
  color: var(--ink);
  font-family: var(--font-cormorant), Georgia, serif;
  font-size: 17px;
}

.universe-connection-detail-text {
  margin-top: 5px;
  color: #85877f;
  font-size: 9px;
  line-height: 1.5;
  letter-spacing: .06em;
}

@keyframes connection-detail-in {
  from { opacity: 0; transform: translate(-50%, 7px); }
  to { opacity: 1; transform: translate(-50%, 0); }
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


async function resolveApplePreview(title: string, artist: string) {
  if (typeof document === "undefined") return null;

  return new Promise<{
    previewUrl: string;
    artworkUrl: string | null;
    albumName: string | null;
  } | null>((resolve) => {
    const callbackName = `__vesperPreview_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const params = new URLSearchParams({
      term: `${title} ${artist}`,
      country: "US",
      media: "music",
      entity: "song",
      limit: "10",
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
    } | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const timeout = window.setTimeout(() => finish(null), 9000);

    const normalize = (value: string) =>
      value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\b(feat\.?|ft\.?)\b.*$/i, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    (window as unknown as Record<string, unknown>)[callbackName] = (
      data: { results?: unknown[] }
    ) => {
      const wantedTitle = normalize(title);
      const wantedArtist = normalize(artist);
      const results = Array.isArray(data?.results) ? data.results : [];
      const candidates = results.filter(
        (result): result is Record<string, unknown> =>
          Boolean(result) && typeof result === "object"
      );

      const exact = candidates.find(
        (result) =>
          typeof result.trackName === "string" &&
          typeof result.artistName === "string" &&
          typeof result.previewUrl === "string" &&
          normalize(result.trackName) === wantedTitle &&
          normalize(result.artistName) === wantedArtist
      );

      const titleMatch = candidates.find(
        (result) =>
          typeof result.trackName === "string" &&
          typeof result.previewUrl === "string" &&
          normalize(result.trackName) === wantedTitle
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const universeRef = useRef<HTMLElement | null>(null);
  const [universeVisible, setUniverseVisible] =
    useState(false);

  const [journey, setJourney] = useState<JourneyStop[]>([]);
  const [journeyClearing, setJourneyClearing] = useState(false);

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

      let playbackUrl = song.playback ?? song.preview;
      let playbackSource: "itunes" | "soundcloud" =
        song.source === "soundcloud" ? "soundcloud" : "itunes";
      let playbackSourceUrl = song.sourceUrl;
      let artwork = song.artwork;
      let album = song.album;

      if (!playbackUrl) {
        const resolved = await resolveApplePreview(song.title, song.artist);
        if (resolved) {
          playbackUrl = resolved.previewUrl;
          playbackSource = "itunes";
          playbackSourceUrl = null;
          artwork = resolved.artworkUrl ?? artwork;
          album = resolved.albumName ?? album;
        }
      }

      // Keep the working Apple resolver first. If Apple blocks the browser
      // catalog request, fall back to Vesper's existing catalog route so a
      // playable SoundCloud/iTunes result can still become the active signal.
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
                  provider: "soundcloud" | "itunes" | "local";
                  url: string | null;
                  sourceUrl?: string | null;
                };
              }>;
            };

            const normalize = (value: string) =>
              value
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/\b(feat\.?|ft\.?)\b.*$/i, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
                .replace(/\s+/g, " ");

            const titleKey = normalize(song.title);
            const artistKey = normalize(song.artist);

            const match = (data.songs ?? [])
              .map((candidate) => {
                const candidateTitle = normalize(candidate.title);
                const candidateArtist = normalize(candidate.artistName);
                const exactTitle = candidateTitle === titleKey;
                const exactArtist = candidateArtist === artistKey;
                const titleContains = candidateTitle.includes(titleKey) || titleKey.includes(candidateTitle);
                const artistContains = candidateArtist.includes(artistKey) || artistKey.includes(candidateArtist);
                const score = exactTitle && exactArtist ? 100 : exactTitle && artistContains ? 90 : titleContains && exactArtist ? 80 : titleContains && artistContains ? 70 : exactTitle ? 60 : 0;
                return { candidate, score };
              })
              .filter((entry) => entry.score > 0 && Boolean(entry.candidate.playback?.url ?? entry.candidate.previewUrl))
              .sort((a, b) => b.score - a.score || Number(Boolean(b.candidate.artworkUrl)) - Number(Boolean(a.candidate.artworkUrl)))[0]?.candidate;

            if (match) {
              playbackUrl = match.playback?.url ?? match.previewUrl;
              playbackSource = match.playback?.provider === "soundcloud" ? "soundcloud" : "itunes";
              playbackSourceUrl = match.playback?.sourceUrl ?? null;
              artwork = match.artworkUrl ?? artwork;
              album = match.albumName ?? album;
            }
          }
        } catch (error) {
          console.warn("Unable to resolve fallback playback:", error);
        }
      }

      if (cancelled || !playbackUrl) return;

      if (activeSong?.id === song.id && activeSong.audioUrl === playbackUrl) {
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
    try {
      const stored = window.sessionStorage.getItem("vesper-journey-v1");
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        setJourney(parsed.slice(-12));
      }
    } catch {
      setJourney([]);
    }
  }, []);

  useEffect(() => {
    const stop: JourneyStop = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album ?? null,
      artwork: song.artwork ?? null,
      preview: song.preview ?? null,
    };

    setJourney((current) => {
      const next = [
        ...current.filter((item) => item.id !== stop.id),
        stop,
      ].slice(-12);

      try {
        window.sessionStorage.setItem(
          "vesper-journey-v1",
          JSON.stringify(next)
        );
      } catch {
        // Session storage can be unavailable in private browsing.
      }

      return next;
    });
  }, [
    song.album,
    song.artist,
    song.artwork,
    song.id,
    song.preview,
    song.title,
  ]);

  const clearJourney = () => {
    setJourneyClearing(true);

    window.setTimeout(() => {
      setJourney([]);
      setJourneyClearing(false);

      try {
        window.sessionStorage.removeItem("vesper-journey-v1");
      } catch {
        // Ignore storage failures.
      }
    }, 420);
  };

  useEffect(() => {
    let cancelled = false;

    async function resolveUniverse() {
      setSelectedNodeId(null);
      setUniverse(null);

      try {
        const query = new URLSearchParams({
          title: song.title,
          artist: song.artist,
        });

        if (song.album) query.set("album", song.album);

        const response = await fetch(
          `/api/music/song/${encodeURIComponent(song.id)}?${query.toString()}`,
          { cache: "force-cache" }
        );

        if (!response.ok) {
          throw new Error(`Universe request failed with ${response.status}`);
        }

        const data = (await response.json()) as UniverseData;

        if (!cancelled) setUniverse(data);
      } catch (error) {
        console.error("Unable to resolve song universe:", error);
        if (!cancelled) setUniverse(null);
      }
    }

    resolveUniverse();

    return () => {
      cancelled = true;
    };
  }, [song.album, song.artist, song.id, song.title]);

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
          universe.graph.center.id
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

            {(activeSong?.id === song.id ? activeSong.artwork : null) || song.artwork ? (
              <img
                className="song-art"
                src={(activeSong?.id === song.id ? activeSong.artwork : null) || song.artwork || ""}
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

        {journey.length > 0 && (
          <section
            key={song.id}
            className={`journey-strip ${journeyClearing ? "is-clearing" : ""}`}
            aria-label="Your musical journey"
          >
            <div className="journey-topline">
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
              {journey.map((stop, index) => {
                const params = new URLSearchParams({
                  title: stop.title,
                  artist: stop.artist,
                });

                if (stop.album) params.set("album", stop.album);
                if (stop.artwork) params.set("artwork", stop.artwork);
                if (stop.preview) params.set("preview", stop.preview);

                const current = stop.id === song.id;

                return (
                  <React.Fragment key={`${stop.id}-${index}`}>
                    {index > 0 && (
                      <span className="journey-arrow" aria-hidden="true">
                        →
                      </span>
                    )}
                    <Link
                      href={`/song/${encodeURIComponent(stop.id)}?${params.toString()}`}
                      className={`journey-stop ${current ? "current" : ""}`}
                      aria-current={current ? "page" : undefined}
                    >
                      <span className="journey-stop-dot" />
                      <span className="journey-stop-copy">
                        <span className="journey-stop-title">
                          {stop.title}
                        </span>
                        <span className="journey-stop-artist">
                          {stop.artist}
                        </span>
                      </span>
                    </Link>
                  </React.Fragment>
                );
              })}
            </div>
          </section>
        )}

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

          <div
            className={`song-universe-stage ${
              graphPoints.length
                ? "is-resolved"
                : ""
            }`}
          >
            {graphPoints.length ? (
              <div className="universe-graph-content">
                {graphPoints.length < 3 && (
                  <div className="universe-sparse-badge">
                    A SMALL CONSTELLATION · {graphPoints.length} {graphPoints.length === 1 ? "CONNECTION" : "CONNECTIONS"}
                  </div>
                )}
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
                          className={`universe-line ${selectedNodeId === point.node.id ? "is-selected" : ""}`}
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
                      {universe.song.title}
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
                          <span className="universe-node-star" aria-hidden="true" />

                          <div className="universe-node-label">
                            {point.node.label}
                          </div>

                          <div className="universe-node-artist">
                            {point.node.artist ?? "Unknown artist"}
                          </div>

                          {typeof point.node.lastFmMatch === "number" && (
                            <div className="universe-node-similarity">
                              {Math.round(point.node.lastFmMatch * 100)}% SIMILAR
                            </div>
                          )}

                          {point.node.genres &&
                            point.node.genres.length > 0 && (
                              <div className="universe-node-genres">
                                {point.node.genres
                                  .slice(0, 2)
                                  .join(" · ")}
                              </div>
                            )}
                        </Link>
                      </div>
                    );
                  }
                )}

                {selectedNodeId && (() => {
                  const selectedNode = universe.graph.nodes.find(
                    (node) => node.id === selectedNodeId
                  );
                  const selectedEdge = universe.graph.edges.find(
                    (edge) =>
                      edge.source === selectedNodeId ||
                      edge.target === selectedNodeId
                  );

                  if (!selectedNode || !selectedEdge) return null;

                  return (
                    <div className="universe-connection-detail" aria-live="polite">
                      <div className="universe-connection-detail-label">
                        WHY THIS SIGNAL
                      </div>
                      <div className="universe-connection-detail-title">
                        {selectedNode.label}
                      </div>
                      <div className="universe-connection-detail-text">
                        {selectedEdge.relationship}
                      </div>
                    </div>
                  );
                })()}

              </div>
            ) : universe ? (
              <div className="universe-empty">
                <div className="universe-quiet-orbit" aria-hidden="true" />

                <div className="universe-quiet-bubbles" aria-hidden="true">
                  <span className="universe-quiet-bubble">✦</span>
                  <span className="universe-quiet-bubble">·</span>
                  <span className="universe-quiet-bubble">✧</span>
                  <span className="universe-quiet-bubble">·</span>
                  <span className="universe-quiet-bubble">✦</span>
                  <span className="universe-quiet-bubble">·</span>
                  <span className="universe-quiet-bubble">✧</span>
                </div>

                <div className="universe-quiet-core">
                  <div className="universe-empty-eyebrow">THE UNIVERSE IS QUIET</div>
                  <div className="universe-empty-title">
                    This signal is still finding its stars.
                  </div>
                  <p className="universe-empty-copy">
                    Vesper only shows connections that are actually established in its music data.
                    Newer, obscure, or less-documented songs may have fewer known connections.
                    We will not fill the sky with random songs just to make it look full.
                  </p>
                </div>
              </div>
            ) : (
              <div className="universe-empty">
                <div className="universe-quiet-orbit" aria-hidden="true" />
                <div className="universe-quiet-bubbles" aria-hidden="true">
                  <span className="universe-quiet-bubble">✦</span>
                  <span className="universe-quiet-bubble">·</span>
                  <span className="universe-quiet-bubble">✧</span>
                  <span className="universe-quiet-bubble">·</span>
                  <span className="universe-quiet-bubble">✦</span>
                  <span className="universe-quiet-bubble">·</span>
                  <span className="universe-quiet-bubble">✧</span>
                </div>
                <div className="universe-quiet-core">
                  <div className="universe-empty-eyebrow">READING THE SIGNAL</div>
                  <div className="universe-empty-title">
                    The universe is still forming.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="universe-source">
            {graphPoints.length >= 8
              ? "Full constellation mapped through Last.fm"
              : graphPoints.length >= 3
                ? "Constellation mapped through Last.fm"
                : graphPoints.length > 0
                  ? "A small constellation mapped through Last.fm"
                  : "Connections appear when Vesper has enough signal to map them"}
          </div>
        </section>
      </main>
    </>
  );
}
