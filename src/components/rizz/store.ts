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
  /** a bot of the player's own: practice, unrated */
  custom?: boolean,
  /** who the simulator plays (`@lib/rizz/personas`), and how picky */
  personaId: string,
  difficulty: RizzDifficulty
};

export type RizzGameRecord = {
  id: string,
  date: number,
  /** the clock the game was played on, when it had one */
  timeControl?: RizzTimeControl,
  opponent: RizzOpponent,
  /** the whole chat, the classifier's verdict on each of the player's messages */
  messages: SimMessage[],
  /** their interest after each of the player's messages: the vibe graph */
  interest: number[],
  /** where the two met */
  setting?: string,
  result: RizzResult,
  reason: RizzEndReason,
  ratingBefore?: number,
  ratingAfter?: number,
  accuracy: number,
  /** the mean Elo of the player's messages */
  gameRating: number,
  /** the coach's written review, once asked for */
  coachReview?: string
};

export type RizzProfile = {
  name: string,
  color: RizzAvatarColor,
  /** every game is against a bot and rated; puzzles have their own */
  ratings: {[key in RizzRatingKind]: number},
  ratingHistory: {[key in RizzRatingKind]: number[]},
  played: {[key in RizzRatingKind]: number},
  games: RizzGameRecord[],
  puzzlesSolved: string[],
  puzzleStreak: number,
  rushBest: number,
  daily: {last: string, streak: number},
  visit: {last: string, streak: number},
  lessonsDone: string[],
  beatenBots: string[],
  /** ghost text is off until switched on; the spice of the suggestions and of the bots is `@lib/rizz/spice`'s */
  settings: {vibeBar: boolean, ghost: boolean, ghostSpice: number, botSpice: number, sex?: RizzSex},
  customBots: RizzBot[]
};

// v3: one rating for games (they are all against bots); v2's games carry over
const STORAGE_KEY = 'rizz-profile-v3';
const PREVIOUS_KEY = 'rizz-profile-v2';

export type RizzRatingKind = 'rizz' | 'puzzles';

/** who the player is: they are matched with the opposite sex */
export type RizzSex = 'male' | 'female';
const MAX_GAMES = 100;

export function defaultProfile(): RizzProfile {
  return {
    name: 'You',
    color: 'blue',
    ratings: {rizz: 800, puzzles: 800},
    ratingHistory: {rizz: [800], puzzles: [800]},
    played: {rizz: 0, puzzles: 0},
    games: [],
    puzzlesSolved: [],
    puzzleStreak: 0,
    rushBest: 0,
    daily: {last: '', streak: 0},
    visit: {last: '', streak: 0},
    lessonsDone: [],
    beatenBots: [],
    settings: {vibeBar: true, ghost: false, ghostSpice: 1, botSpice: 1},
    customBots: []
  };
}

function readProfile(): RizzProfile {
  const fresh = defaultProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const previous = !raw && localStorage.getItem(PREVIOUS_KEY);
    if(!raw && !previous) return fresh;
    const stored = JSON.parse(raw || previous);
    if(previous) {
      // * the three clocks' ratings become the one rating: the best of them
      const best = (values: number[]) => Math.max(...values.filter((value) => typeof(value) === 'number'), fresh.ratings.rizz);
      const old = stored.ratings || {};
      stored.ratings = {rizz: best([old.bullet, old.blitz, old.rapid]), puzzles: old.puzzles ?? fresh.ratings.puzzles};
      stored.ratingHistory = {rizz: [stored.ratings.rizz], puzzles: stored.ratingHistory?.puzzles || [stored.ratings.puzzles]};
      stored.played = {rizz: (stored.played?.bullet || 0) + (stored.played?.blitz || 0) + (stored.played?.rapid || 0), puzzles: stored.played?.puzzles || 0};
      delete stored.league;
      // * ghost text was on by default before: it is the player's to switch on
      if(stored.settings) stored.settings.ghost = false;
    }
    // shallow-merge so a field added later gets its default
    return {
      ...fresh,
      ...stored,
      ratings: {...fresh.ratings, ...stored.ratings},
      ratingHistory: {...fresh.ratingHistory, ...stored.ratingHistory},
      played: {...fresh.played, ...stored.played},
      settings: {...fresh.settings, ...stored.settings}
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
    if(record.opponent.bot && !record.opponent.custom && record.result === 'win' && !draft.beatenBots.includes(record.opponent.id)) {
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
