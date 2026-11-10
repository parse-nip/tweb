/*
 * The player's progress: ratings, games, puzzles, streaks, the league. There is no server — the
 * game is offline — so it lives in this browser's localStorage, read once and written on change.
 */

import {createRoot, createEffect} from 'solid-js';
import {createStore, produce, unwrap} from 'solid-js/store';
import {dayKey, RizzEndReason, RizzResult} from '@components/rizz/engine';
import type {RizzAvatarColor, RizzBot} from '@components/rizz/content/bots';
import type {RizzDifficulty} from '@lib/rizz/personas';
import type {SimMessage} from '@lib/rizz/simulator';
import type {RizzVerdict} from '@lib/rizz/ratings';

export type RizzTimeControl = 'bullet' | 'blitz' | 'rapid';

export const TIME_CONTROLS: {[key in RizzTimeControl]: {label: string, base: number, increment: number, icon: string}} = {
  bullet: {label: 'Bullet', base: 60, increment: 3, icon: '⚡'},
  blitz: {label: 'Blitz', base: 180, increment: 5, icon: '🔥'},
  rapid: {label: 'Rapid', base: 600, increment: 10, icon: '⏱'}
};

export type RizzOpponent = {
  id: string,
  name: string,
  rating: number,
  color: RizzAvatarColor,
  title?: string,
  bot?: boolean,
  /** who the simulator plays (`@lib/rizz/personas`), and how picky */
  personaId: string,
  difficulty: RizzDifficulty
};

export type RizzGameRecord = {
  id: string,
  date: number,
  /** Rated games are online ones with a clock; bot games are unrated, as on chess.com. */
  timeControl?: RizzTimeControl,
  opponent: RizzOpponent,
  /** the whole chat, the classifier's verdict on each of the player's messages */
  messages: SimMessage[],
  /** their interest after each of the player's messages: the vibe graph */
  interest: number[],
  result: RizzResult,
  reason: RizzEndReason,
  ratingBefore?: number,
  ratingAfter?: number,
  accuracy: number,
  /** the mean Elo of the player's messages */
  gameRating: number,
  /** the coach's written review, once asked for */
  feedback?: string
};

export type RizzProfile = {
  name: string,
  color: RizzAvatarColor,
  ratings: {[key in RizzTimeControl | 'puzzles']: number},
  ratingHistory: {[key in RizzTimeControl | 'puzzles']: number[]},
  played: {[key in RizzTimeControl | 'puzzles']: number},
  games: RizzGameRecord[],
  puzzlesSolved: string[],
  puzzleStreak: number,
  rushBest: number,
  daily: {last: string, streak: number},
  visit: {last: string, streak: number},
  lessonsDone: string[],
  beatenBots: string[],
  league: {week: string, division: number, trophies: number, lastResult?: 'promoted' | 'demoted' | 'stayed'},
  settings: {vibeBar: boolean, ghost: boolean},
  customBots: RizzBot[]
};

// v2: games hold the Rizz Coach's chat and verdicts
const STORAGE_KEY = 'rizz-profile-v2';
const MAX_GAMES = 100;

export function weekKey(date = new Date()) {
  // ISO week: the Thursday of this week decides the year
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function defaultProfile(): RizzProfile {
  return {
    name: 'You',
    color: 'blue',
    ratings: {bullet: 800, blitz: 800, rapid: 800, puzzles: 800},
    ratingHistory: {bullet: [800], blitz: [800], rapid: [800], puzzles: [800]},
    played: {bullet: 0, blitz: 0, rapid: 0, puzzles: 0},
    games: [],
    puzzlesSolved: [],
    puzzleStreak: 0,
    rushBest: 0,
    daily: {last: '', streak: 0},
    visit: {last: '', streak: 0},
    lessonsDone: [],
    beatenBots: [],
    league: {week: weekKey(), division: 0, trophies: 0},
    settings: {vibeBar: true, ghost: true},
    customBots: []
  };
}

function readProfile(): RizzProfile {
  const fresh = defaultProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return fresh;
    const stored = JSON.parse(raw);
    // shallow-merge so a field added later gets its default
    return {
      ...fresh,
      ...stored,
      ratings: {...fresh.ratings, ...stored.ratings},
      ratingHistory: {...fresh.ratingHistory, ...stored.ratingHistory},
      played: {...fresh.played, ...stored.played},
      settings: {...fresh.settings, ...stored.settings},
      league: {...fresh.league, ...stored.league}
    };
  } catch(err) {
    return fresh;
  }
}

const [profile, setProfile] = createRoot(() => {
  const store = createStore<RizzProfile>(readProfile());
  createEffect(() => {
    const json = JSON.stringify(store[0]);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch(err) {}
  });
  return store;
});

export {profile, setProfile};

export function resetProfile() {
  setProfile(defaultProfile());
}

/** Counts today's visit for the streak shown in the header. */
export function touchVisit(today = dayKey()) {
  if(profile.visit.last === today) return;
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  setProfile('visit', {last: today, streak: profile.visit.last === yesterday ? profile.visit.streak + 1 : 1});
}

export function pushRating(kind: keyof RizzProfile['ratings'], value: number) {
  setProfile(produce((draft) => {
    draft.ratings[kind] = value;
    draft.ratingHistory[kind] = [...draft.ratingHistory[kind], value].slice(-60);
    draft.played[kind]++;
  }));
}

export function saveGame(record: RizzGameRecord) {
  setProfile(produce((draft) => {
    draft.games = [record, ...draft.games].slice(0, MAX_GAMES);
    if(record.opponent.bot && record.result === 'win' && !draft.beatenBots.includes(record.opponent.id)) {
      draft.beatenBots.push(record.opponent.id);
    }
  }));
}

export function getGame(id: string) {
  return profile.games.find((game) => game.id === id);
}

export function snapshot() {
  return structuredClone(unwrap(profile));
}
