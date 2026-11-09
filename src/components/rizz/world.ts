/*
 * Everyone else: matchmaking opponents, the leaderboard and the weekly league. The game has no
 * server, so the other players are simulated — seeded, so they stay the same between visits and
 * move on as the week goes by.
 */

import {AVATAR_COLORS, BOTS, ONLINE_NAMES, RizzBot} from '@components/rizz/content/bots';
import {hashString, seededRandom} from '@components/rizz/engine';
import {profile, RizzOpponent, RizzProfile, RizzTimeControl, setProfile, weekKey} from '@components/rizz/store';

export const DIVISIONS = [
  {name: 'Wood', emoji: '🪵'},
  {name: 'Stone', emoji: '🪨'},
  {name: 'Bronze', emoji: '🥉'},
  {name: 'Silver', emoji: '🥈'},
  {name: 'Crystal', emoji: '💎'},
  {name: 'Elite', emoji: '⚜️'},
  {name: 'Champion', emoji: '🏆'},
  {name: 'Legend', emoji: '👑'}
];

export const LEAGUE_SIZE = 30;
export const PROMOTE = 5;
export const DEMOTE = 5;

export const TROPHIES = {win: 10, draw: 5, loss: 1, puzzle: 2};

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

/** An online opponent near the player's rating. */
export function findOpponent(timeControl: RizzTimeControl, random: () => number = Math.random): RizzOpponent {
  const rating = Math.max(100, Math.round(profile.ratings[timeControl] + (random() - 0.5) * 300));
  const name = pick(ONLINE_NAMES, random);
  return {
    id: 'online-' + name.toLowerCase() + '-' + rating,
    name,
    rating,
    color: pick(AVATAR_COLORS, random)
  };
}

export type RizzBoardEntry = {name: string, rating: number, color: string, me?: boolean, title?: string, country: string};

const COUNTRIES = ['🇺🇸', '🇬🇧', '🇧🇷', '🇮🇳', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇯🇵', '🇰🇷', '🇳🇬', '🇲🇽', '🇨🇦', '🇦🇺', '🇵🇱', '🇹🇷', '🇺🇦', '🇳🇱', '🇸🇪', '🇦🇷'];

/** The global top list for a rating kind, with the player placed where their rating puts them. */
export function leaderboard(kind: keyof RizzProfile['ratings']) {
  const random = seededRandom(hashString('leaderboard-' + kind));
  const entries: RizzBoardEntry[] = [];
  let rating = 2900 + Math.round(random() * 150);
  for(let i = 0; i < 50; ++i) {
    const name = pick(ONLINE_NAMES, random) + pick(['', 'x', '_', '99', 'rizz', 'GM', '.exe', '23'], random);
    entries.push({
      name,
      rating,
      color: pick(AVATAR_COLORS, random),
      title: i < 6 ? 'GM' : i < 14 ? 'IM' : undefined,
      country: pick(COUNTRIES, random)
    });
    rating -= 5 + Math.round(random() * 30);
  }

  const mine = profile.ratings[kind];
  // below the top 50: a rank estimated from a long tail
  const rank = mine > entries[entries.length - 1].rating ?
    entries.findIndex((entry) => entry.rating < mine) + 1 :
    Math.round(50 + Math.pow((entries[entries.length - 1].rating - mine) / 10, 1.6) * 40);
  return {entries, rank, mine};
}

export type RizzLeagueEntry = {name: string, trophies: number, color: string, me?: boolean};

/** How far through the week we are, 0…1. */
function weekProgress(date = new Date()) {
  const day = (date.getDay() + 6) % 7; // Monday 0
  return Math.min(1, (day + (date.getHours() + date.getMinutes() / 60) / 24) / 7);
}

export function leagueTable(week = profile.league.week, division = profile.league.division, trophies = profile.league.trophies, date = new Date()): RizzLeagueEntry[] {
  const random = seededRandom(hashString(`league-${week}-${division}`));
  const progress = week === weekKey(date) ? weekProgress(date) : 1;
  const others: RizzLeagueEntry[] = [];
  for(let i = 0; i < LEAGUE_SIZE - 1; ++i) {
    // activity: some players grind, most are casual, a few never show up
    const activity = Math.pow(random(), 1.8) * (60 + division * 25);
    others.push({
      name: pick(ONLINE_NAMES, random),
      trophies: Math.round(activity * progress),
      color: pick(AVATAR_COLORS, random)
    });
  }

  const table = [...others, {name: profile.name, trophies, color: profile.color, me: true}];
  return table.sort((a, b) => b.trophies - a.trophies || (a.me ? -1 : b.me ? 1 : 0));
}

/** On a new week: promote, demote or keep the player, then start a fresh table. */
export function settleLeague(date = new Date()) {
  const current = weekKey(date);
  const league = profile.league;
  if(league.week === current) return;

  const table = leagueTable(league.week, league.division, league.trophies, date);
  const rank = table.findIndex((entry) => entry.me) + 1;
  let division = league.division;
  let lastResult: 'promoted' | 'demoted' | 'stayed' = 'stayed';
  if(rank <= PROMOTE && league.trophies > 0 && division < DIVISIONS.length - 1) {
    division++;
    lastResult = 'promoted';
  } else if(rank > LEAGUE_SIZE - DEMOTE && division > 0) {
    division--;
    lastResult = 'demoted';
  }

  setProfile('league', {week: current, division, trophies: 0, lastResult});
}

export function addTrophies(count: number) {
  settleLeague();
  setProfile('league', 'trophies', (value) => value + count);
}

/*
 * Achievements.
 */

export type RizzAchievement = {id: string, emoji: string, title: string, description: string, done: (p: RizzProfile) => boolean};

export const ACHIEVEMENTS: RizzAchievement[] = [
  {id: 'first-game', emoji: '💬', title: 'First words', description: 'Finish your first game', done: (p) => p.games.length > 0},
  {id: 'first-date', emoji: '💘', title: 'It\'s a date', description: 'Win a game', done: (p) => p.games.some((g) => g.result === 'win')},
  {id: 'brilliant', emoji: '💎', title: 'Brilliant!!', description: 'Find a brilliant reply in a game', done: (p) => p.games.some((g) => g.moves.some((m) => m.classification === 'brilliant'))},
  {id: 'flawless', emoji: '🎯', title: 'Flawless', description: 'Play a game with 95%+ accuracy', done: (p) => p.games.some((g) => g.accuracy >= 95)},
  {id: 'bot-slayer', emoji: '🤖', title: 'Bot whisperer', description: 'Beat three different bots', done: (p) => p.beatenBots.length >= 3},
  {id: 'gm', emoji: '👑', title: 'Grandmistress down', description: 'Beat Valentina', done: (p) => p.beatenBots.includes('valentina')},
  {id: 'puzzles-10', emoji: '🧩', title: 'Puzzler', description: 'Solve 10 puzzles', done: (p) => p.puzzlesSolved.length >= 10},
  {id: 'rush-10', emoji: '⚡', title: 'Rush hour', description: 'Score 10+ in Puzzle Rush', done: (p) => p.rushBest >= 10},
  {id: 'daily-3', emoji: '📅', title: 'Habit', description: 'Solve the daily puzzle 3 days in a row', done: (p) => p.daily.streak >= 3},
  {id: 'student', emoji: '🎓', title: 'Student of the game', description: 'Finish every lesson', done: (p) => p.lessonsDone.length >= 4},
  {id: '1200', emoji: '📈', title: 'Club player', description: 'Reach 1200 in any time control', done: (p) => Math.max(p.ratings.bullet, p.ratings.blitz, p.ratings.rapid) >= 1200},
  {id: 'promoted', emoji: '🏆', title: 'Moving up', description: 'Get promoted in Leagues', done: (p) => p.league.division > 0}
];

/** The built-in bots, then the player's own from the bot maker. */
export function allBots(): RizzBot[] {
  return [...BOTS, ...profile.customBots];
}

export function getBot(id: string) {
  return allBots().find((bot) => bot.id === id);
}

export function saveCustomBot(bot: RizzBot) {
  setProfile('customBots', (list) => list.some((item) => item.id === bot.id) ?
    list.map((item) => item.id === bot.id ? bot : item) :
    [...list, bot]);
}

export function deleteCustomBot(id: string) {
  setProfile('customBots', (list) => list.filter((item) => item.id !== id));
}
