/*
 * Lessons: a coach's short channel posts, then a drill — puzzles from the opening book that
 * practise what the lesson says (`drill` lists puzzle ids, `engine.ts` → `puzzleId`).
 */

export type RizzLesson = {
  id: string,
  title: string,
  subtitle: string,
  posts: string[],
  drill: string[]
};

const LESSONS: RizzLesson[] = [{
  id: 'openers',
  title: 'Opening theory',
  subtitle: 'The first move decides the next ten',
  posts: [
    'Every great game starts with a move that gives the other side something to play with. "Hey" is legal. It is also a pass.',
    'The best openers answer their profile, their story or the moment you met — something only they could have sent you.',
    'Add a question or a small tease so replying is easy and fun. Openers that are a statement need a hook.',
    'Book moves (📖 in Game Review) are openers with a long track record. Learn them, then make them yours.'
  ],
  drill: ['travel-bio/0', 'story-reply/0', 'bookstore/0', 'group-chat/0']
}, {
  id: 'middlegame',
  title: 'The middle game',
  subtitle: 'Banter, callbacks and curiosity',
  posts: [
    'In the middle game, the goal is not information. It\'s rhythm. Short, playful, one hook per message.',
    'Callbacks — returning to an earlier joke — are the knight forks of conversation: one move, two threats.',
    'When they hand you a detail (a dog\'s name, a favourite smoothie), take it. Ignoring it is a Miss.',
    'One-word replies are waiting moves. In a game with a clock, waiting moves lose.'
  ],
  drill: ['story-reply/1', 'dog-photo/1', 'gym/2', 'group-chat/3']
}, {
  id: 'closing',
  title: 'Closing the game',
  subtitle: 'From banter to a plan',
  posts: [
    'Checkmate is a plan: a day, a place and a reason. "We should hang out sometime" is a draw offer.',
    'The best closes grow out of the conversation — the bakery you didn\'t name, the cook-off, the book swap.',
    'Two options beat one question: "Saturday or Sunday?" is easier to answer than "when are you free?".',
    'If they hesitate, lower the stakes and stay warm. Pressure turns a winning position into a loss.'
  ],
  drill: ['travel-bio/4', 'gym/3', 'bookstore/4', 'dog-photo/3']
}, {
  id: 'blunders',
  title: 'Avoiding blunders',
  subtitle: 'The moves that lose instantly',
  posts: [
    'Most games are lost, not won. The fastest losses: pushiness, neediness and punishing hesitation.',
    '"Your loss" and "why are you being difficult" have never once won a game in recorded history.',
    'Asking for photos, mentioning their body or your place early — each is a blunder (??) in any position.',
    'When in doubt, play the calm move: warm, specific, no pressure.'
  ],
  drill: ['travel-bio/5', 'group-chat/5', 'dog-photo/4', 'bookstore/3']
}];

export default LESSONS;
