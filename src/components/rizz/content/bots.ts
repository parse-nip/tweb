/*
 * The opponents. A bot's rating is what a win or a loss against it is worth; its `difficulty` is how
 * hard it is to charm — it scales the engine's scores (a good reply lands softer, a bad one harder).
 */

export type RizzAvatarColor = 'red' | 'orange' | 'violet' | 'green' | 'cyan' | 'pink' | 'blue' | 'premium' | 'stars';

export type RizzBot = {
  id: string,
  name: string,
  rating: number,
  difficulty: number,
  color: RizzAvatarColor,
  /** The line under their name in the bot list, as a chat's last message. */
  tagline: string,
  /** What they say when the game starts — a bot's chat card in chess.com style. */
  greeting: string,
  title?: string,
  /** Made in the bot maker: kept with the player's progress. */
  custom?: boolean,
  /** A custom bot can meet you in one place only; otherwise every game picks a scenario. */
  scenarioId?: string,
  personality?: RizzPersonality
};

export type RizzPersonality = 'sweet' | 'witty' | 'shy' | 'tough';

/** The bot maker's personalities: how a bot greets you, and how hard it is to impress at its rating. */
export const PERSONALITIES: {[key in RizzPersonality]: {label: string, icon: Icon, greeting: string, tagline: string, factor: number}} = {
  sweet: {label: 'Sweet', icon: 'like', greeting: 'Hiii 🥰 tell me something nice', tagline: 'Warm and forgiving.', factor: 0.85},
  witty: {label: 'Witty', icon: 'smile', greeting: 'Go on, make me laugh.', tagline: 'Loves banter, hates boring.', factor: 1},
  shy: {label: 'Shy', icon: 'hide', greeting: 'oh hi… 👉👈', tagline: 'Opens up to patience.', factor: 1.1},
  tough: {label: 'Tough', icon: 'fire', greeting: 'You get one shot.', tagline: 'Heard every line before.', factor: 1.25}
};

export const BOTS: RizzBot[] = [{
  id: 'sunny',
  name: 'Sunny',
  rating: 400,
  difficulty: 0.6,
  color: 'orange',
  tagline: 'Laughs at everything. A great place to start.',
  greeting: 'Hiii! Be nice, I\'m new here 🌞'
}, {
  id: 'theo',
  name: 'Theo',
  rating: 800,
  difficulty: 0.8,
  color: 'green',
  tagline: 'Friendly, a bit shy. Rewards curiosity.',
  greeting: 'Hey. I\'m not great at texting, fair warning'
}, {
  id: 'mia',
  name: 'Mia',
  rating: 1200,
  difficulty: 1,
  color: 'pink',
  tagline: 'Witty and quick. Boring replies get left on read.',
  greeting: 'Impress me 💅'
}, {
  id: 'kai',
  name: 'Kai',
  rating: 1600,
  difficulty: 1.2,
  color: 'cyan',
  tagline: 'Has heard every line. Needs something real.',
  greeting: 'Let me guess. You\'re going to say hey.'
}, {
  id: 'ivy',
  name: 'Ivy',
  rating: 2000,
  difficulty: 1.45,
  color: 'violet',
  tagline: 'Sharp, selective, rarely double-texts.',
  greeting: 'You have six messages. Use them wisely.'
}, {
  id: 'valentina',
  name: 'Valentina',
  rating: 2500,
  difficulty: 1.75,
  color: 'premium',
  title: 'GM',
  tagline: 'Grandmistress of rizz. Unbeaten this season.',
  greeting: 'Most people don\'t make it past the opener. Go ahead.'
}];

/** Names the matchmaking draws from for online opponents. */
export const ONLINE_NAMES = [
  'Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan', 'Avery', 'Quinn', 'Rowan', 'Skyler', 'Jamie',
  'Noa', 'Elliot', 'Remy', 'Sasha', 'Robin', 'Dakota', 'Emerson', 'Finley', 'Harper', 'Indigo', 'Jules',
  'Kit', 'Lane', 'Marlowe', 'Nico', 'Oakley', 'Parker', 'Reese', 'Sage', 'Tatum', 'Wren', 'Zion'
];

export const AVATAR_COLORS: RizzAvatarColor[] = ['red', 'orange', 'violet', 'green', 'cyan', 'pink', 'blue'];
