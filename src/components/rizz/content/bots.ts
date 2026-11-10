/*
 * The opponents: the Rizz Coach's personas (`@lib/rizz/personas`) as the game's bots, and the ones the player
 * makes in the bot maker. A bot's rating is its persona's Elo — what a win against it is worth.
 */

import {RIZZ_PERSONAS, RizzPersona} from '@lib/rizz/personas';
import type {RizzGender} from '@lib/rizz/simulator';

export type RizzAvatarColor = 'red' | 'orange' | 'violet' | 'green' | 'cyan' | 'pink' | 'blue' | 'premium' | 'stars';

export type RizzBot = {
  /** the persona's id: what the simulator plays */
  id: string,
  name: string,
  rating: number,
  color: RizzAvatarColor,
  /** the line under their name in the list, as a chat's last message */
  tagline: string,
  /** what kind of texter they are: the persona's own title */
  kind?: string,
  /** a built-in bot is a woman or a man, as the player is matched */
  gender?: RizzGender,
  /** made in the bot maker: kept with the player's progress */
  custom?: boolean,
  /** a custom bot's character, as the persona prompt has it */
  prompt?: string,
  startInterest?: number,
  personality?: RizzPersonality
};

export type RizzPersonality = 'sweet' | 'witty' | 'shy' | 'tough';

/** The bot maker's personalities: the character a custom bot starts from, and how warm it starts. */
export const PERSONALITIES: {[key in RizzPersonality]: {label: string, icon: Icon, tagline: string, prompt: string, startInterest: number}} = {
  sweet: {
    label: 'Sweet', icon: 'like', tagline: 'Warm and forgiving.', startInterest: 60,
    prompt: 'You are warm, kind and easy to talk to. You reward effort and sincerity and forgive small awkwardness.'
  },
  witty: {
    label: 'Witty', icon: 'smile', tagline: 'Loves banter, hates boring.', startInterest: 45,
    prompt: 'You are quick and playful. You love banter and a good comeback, and get bored by flat, safe messages.'
  },
  shy: {
    label: 'Shy', icon: 'hide', tagline: 'Opens up to patience.', startInterest: 40,
    prompt: 'You are shy. You answer briefly at first and open up to genuine, specific curiosity. Pressure makes you retreat.'
  },
  tough: {
    label: 'Tough', icon: 'fire', tagline: 'Heard every line before.', startInterest: 25,
    prompt: 'You are hard to impress and have heard every line. Only confident, specific, funny messages move you; neediness ends it.'
  }
};

const PERSONA_COLORS: RizzAvatarColor[] = ['green', 'orange', 'cyan', 'pink', 'blue', 'violet', 'red', 'premium'];

/**
 * The personas as bots, of the gender the player is matched with: all women, all men, or — before the player has
 * said who they are — a mix.
 */
export function buildBots(match?: RizzGender): RizzBot[] {
  return RIZZ_PERSONAS
  .map((persona, index) => {
    const gender: RizzGender = match || (index % 2 ? 'man' : 'woman');
    return {
      id: persona.id,
      name: (gender === 'man' ? persona.maleName : persona.firstName) || persona.name.replace(/^The /, ''),
      kind: persona.name.replace(/^The /, ''),
      gender,
      rating: persona.elo,
      color: PERSONA_COLORS[index % PERSONA_COLORS.length],
      tagline: persona.tagline
    };
  })
  .sort((a, b) => a.rating - b.rating);
}

/** A custom bot as the simulator's persona. */
export function botPersona(bot: RizzBot): RizzPersona {
  return {
    id: bot.id,
    emoji: '🤖',
    name: bot.name,
    tagline: bot.tagline,
    prompt: bot.prompt || PERSONALITIES[bot.personality || 'witty'].prompt,
    startInterest: bot.startInterest ?? PERSONALITIES[bot.personality || 'witty'].startInterest,
    elo: bot.rating
  };
}

/** Names the matchmaking draws from for online opponents. */
export const ONLINE_NAMES = [
  'Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan', 'Avery', 'Quinn', 'Rowan', 'Skyler', 'Jamie',
  'Noa', 'Elliot', 'Remy', 'Sasha', 'Robin', 'Dakota', 'Emerson', 'Finley', 'Harper', 'Indigo', 'Jules',
  'Kit', 'Lane', 'Marlowe', 'Nico', 'Oakley', 'Parker', 'Reese', 'Sage', 'Tatum', 'Wren', 'Zion'
];

export const AVATAR_COLORS: RizzAvatarColor[] = ['red', 'orange', 'violet', 'green', 'cyan', 'pink', 'blue'];
