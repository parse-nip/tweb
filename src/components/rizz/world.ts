/*
 * The opponents and the milestones. Every opponent is a bot — one of the Rizz Coach's personas, or one the player
 * made — so there is no one else to match against: a quick game is the bot, at the difficulty, closest to the
 * player's rating.
 */

import {BOTS, botPersona, RizzBot} from '@components/rizz/content/bots';
import {RIZZ_DIFFICULTIES, RizzDifficulty, setCustomRizzPersonas} from '@lib/rizz/personas';
import {profile, RizzProfile, setProfile} from '@components/rizz/store';

/** A bot's strength at a difficulty: what a game against it is rated as. */
export function botRating(bot: RizzBot, difficulty: RizzDifficulty) {
  return bot.rating + (RIZZ_DIFFICULTIES.find((item) => item.id === difficulty)?.eloShift ?? 0);
}

/** A quick game: one of the three bots (at a difficulty) closest to the player's rating. */
export function quickBot(random: () => number = Math.random): {bot: RizzBot, difficulty: RizzDifficulty} {
  const options = allBots().flatMap((bot) => RIZZ_DIFFICULTIES.map((difficulty) => ({
    bot,
    difficulty: difficulty.id,
    gap: Math.abs(botRating(bot, difficulty.id) - profile.ratings.rizz)
  }))).sort((a, b) => a.gap - b.gap).slice(0, 3);
  return options[Math.floor(random() * options.length)];
}

export type RizzAchievement = {id: string, emoji: string, title: string, description: string, done: (p: RizzProfile) => boolean};

export const ACHIEVEMENTS: RizzAchievement[] = [
  {id: 'first-game', emoji: '💬', title: 'First words', description: 'Finish your first game', done: (p) => p.games.length > 0},
  {id: 'first-date', emoji: '💘', title: 'It\'s a date', description: 'Win a game', done: (p) => p.games.some((g) => g.result === 'win')},
  {id: 'brilliant', emoji: '💎', title: 'Brilliant!!', description: 'Send a Brilliant message in a game', done: (p) => p.games.some((g) => g.messages.some((m) => m.verdict?.rating === 'brilliant'))},
  {id: 'flawless', emoji: '🎯', title: 'Flawless', description: 'Play a game with 90+ accuracy', done: (p) => p.games.some((g) => g.accuracy >= 90)},
  {id: 'bot-slayer', emoji: '🤖', title: 'Bot whisperer', description: 'Beat three different bots', done: (p) => p.beatenBots.length >= 3},
  {id: 'gm', emoji: '👑', title: 'Thawed the ex', description: 'Win back the Ex Who Left You on Read', done: (p) => p.beatenBots.includes('ex')},
  {id: 'puzzles-10', emoji: '🧩', title: 'Puzzler', description: 'Solve 10 puzzles', done: (p) => p.puzzlesSolved.length >= 10},
  {id: 'rush-10', emoji: '⚡', title: 'Rush hour', description: 'Score 10+ in Puzzle Rush', done: (p) => p.rushBest >= 10},
  {id: 'daily-3', emoji: '📅', title: 'Habit', description: 'Solve the daily puzzle 3 days in a row', done: (p) => p.daily.streak >= 3},
  {id: 'student', emoji: '🎓', title: 'Student of the game', description: 'Finish every lesson', done: (p) => p.lessonsDone.length >= 4},
  {id: '1200', emoji: '📈', title: 'Club player', description: 'Reach a 1200 rating', done: (p) => p.ratings.rizz >= 1200},
  {id: 'hard', emoji: '🔥', title: 'No easy mode', description: 'Win a game on Hard', done: (p) => p.games.some((g) => g.result === 'win' && g.opponent.difficulty === 'hard')}
];

/** The built-in bots, then the player's own from the bot maker. */
export function allBots(): RizzBot[] {
  return [...BOTS, ...profile.customBots];
}

export function getBot(id: string) {
  return allBots().find((bot) => bot.id === id);
}

/** Hands the player's bots to the simulator as personas: on start, and on every change. */
export function syncCustomPersonas() {
  setCustomRizzPersonas(profile.customBots.map(botPersona));
}

export function saveCustomBot(bot: RizzBot) {
  setProfile('customBots', (list) => list.some((item) => item.id === bot.id) ?
    list.map((item) => item.id === bot.id ? bot : item) :
    [...list, bot]);
  syncCustomPersonas();
}

export function deleteCustomBot(id: string) {
  setProfile('customBots', (list) => list.filter((item) => item.id !== id));
  syncCustomPersonas();
}
