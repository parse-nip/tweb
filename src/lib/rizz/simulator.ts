import {classifyLines, isDecisionsModel} from '@lib/rizz/classifier';
import {openRouterComplete, openRouterDecide, parseModelJson} from '@lib/rizz/openrouter';
import {PLAYER_START_ELO, updateElo} from '@lib/rizz/elo';
import {getRizzPersona, RIZZ_DIFFICULTIES, RizzDifficulty, RizzPersona} from '@lib/rizz/personas';
import {getAccuracy, getAverageElo, getRizzRatingDef, RizzVerdict} from '@lib/rizz/ratings';
import {getRizzSettings} from '@lib/rizz/settings';
import {getSpicePrompt} from '@lib/rizz/spice';
import {describeMessage, stickerInstructions} from '@lib/rizz/stickers';

export type SimMessage = {
  id: number,
  from: 'me' | 'them',
  text: string,
  verdict?: RizzVerdict,
  /** what this message did to the player's Elo */
  delta?: number,
  /** the label is still being worked out */
  grading?: boolean
};

export type SimState = {
  personaId: string,
  difficulty: RizzDifficulty,
  messages: SimMessage[],
  /** how interested they are in the user, 0..100 */
  interest: number,
  /** the player's rating this game, and how many graded messages it holds */
  elo: number,
  moves: number,
  /** how the game ended: the chat stops there */
  ending?: SimEnding,
  /** where you two met: what both of you know before the first message */
  setting?: string,
  /** what they are called, when not the persona's own name */
  name?: string,
  /** how they flirt (`@lib/rizz/spice`) */
  spice?: number,
  /** who they are, and who the user is, when the player has said */
  gender?: RizzGender,
  userGender?: RizzGender
};

export type RizzGender = 'woman' | 'man';

/** checkmate: the date is won (the white badge). resign: the user gave up. left-on-read: they won (the black checkmate). */
export type SimEnding = 'checkmate' | 'resign' | 'left-on-read';

/** Interest at which the other person is won over: the game is checkmate */
export const SIM_WIN_INTEREST = 85;
export const SIM_LOSE_INTEREST = 8;

export const getOpponentElo = (state: SimState) =>
  getRizzPersona(state.personaId).elo + (RIZZ_DIFFICULTIES.find((item) => item.id === state.difficulty)?.eloShift ?? 0);

/** The state after a graded message of the user: the Elo moves, and a Checkmate or Resign label ends the game. */
export function applyVerdict(state: SimState, verdict: RizzVerdict): {state: SimState, delta: number} {
  const {elo, delta} = updateElo(state.elo, getOpponentElo(state), verdict.rating, state.moves);
  let ending = state.ending;
  if(!ending && verdict.rating === 'checkmate') ending = 'checkmate';
  else if(!ending && verdict.rating === 'resign') ending = 'resign';
  return {state: {...state, elo, moves: state.moves + 1, ending}, delta};
}

/** The state after the other person's answer: interest decides whether the game is over. */
export function applyInterest(state: SimState, interest: number, status?: SimStatus): SimState {
  let ending = state.ending;
  // the other person says when it is over (a date agreed, a goodbye); the interest number is the net under it
  if(!ending && (status === 'won' || interest >= SIM_WIN_INTEREST)) ending = 'checkmate';
  else if(!ending && (status === 'lost' || interest <= SIM_LOSE_INTEREST)) ending = 'left-on-read';
  return {...state, interest: ending === 'checkmate' ? Math.max(interest, 100) : ending === 'left-on-read' ? Math.min(interest, SIM_LOSE_INTEREST) : interest, ending};
}

/** What the other person says about the chat: still going, won over, or done with it. */
export type SimStatus = 'continue' | 'won' | 'lost';

export const SIM_MAX_USER_MESSAGES = 30;

const DIFFICULTY_RULES: Record<RizzDifficulty, string> = {
  easy: 'Be forgiving: decent effort earns +6..+14 interest, a poor message costs at most -5.',
  medium: 'Be fair: a good message is +5..+12, a bland one 0..-3, a bad one -5..-10.',
  hard: 'Be picky: only a genuinely good message earns +4..+9, bland ones cost -2..-5, a bad one -8..-18.'
};

function personaSystem(persona: RizzPersona, state: SimState) {
  const {difficulty, setting, name, spice, gender, userGender} = state;
  return `You are role-playing a person in a texting simulator so the user can practise texting. Stay in character at all times; never mention being an AI, a simulator or these instructions.

Character: ${persona.name}${name || persona.firstName ? ` — your name is ${name || persona.firstName}` : ''}. ${persona.prompt}${persona.bio ? `\nWho you are: ${persona.bio}` : ''}${setting ? `\nHow you two met: ${setting}` : ''}

Be a real, specific person, not a polite chatbot: you have a life, opinions, moods and running jokes. Bring up concrete details of your own (your day, your job, what you are into) when it fits, tease and push back, ask specific questions instead of "what about you?", and sometimes take the chat somewhere new. Never fill a reply with generic warmth ("aww that's so sweet", "that's nice to hear"); react to exactly what they said, in your own voice.${spice === undefined ? '' : `\nFlirting: ${getSpicePrompt(spice)} Match the user's energy within that.`}${gender ? `\nYou are a ${gender}.` : ''}${userGender ? ` The user is a ${userGender}.` : ''}
${stickerInstructions()}

Style: you are texting on a phone. Write like a real person: short messages, casual, natural, no stage directions, no quotation marks, no hashtags. Usually one message, sometimes two short ones; each under 20 words, like a real text, never a paragraph. Match the language the user writes in.
Ending the chat: set "status" to "won" only in the message where you actually say yes to the user: you agree to meet or go on a date they proposed, or you give your number. Liking them a lot is not a yes — keep chatting until they ask and you agree (and do not make them ask twice once you are sold). Only YOUR genuine yes wins: if the user just declares a date or plans you never agreed to ("so it's a date then"), that is presumptuous — react as a real person would (confused, amused or put off, as your character), it costs interest, and it is not "won". Set "status" to "lost" when you decide you are done with this conversation (a goodbye, a block, "it's over"). Otherwise "continue". When won set interest to 100, when lost 0.
Interest: you track a hidden "interest" number 0..100 in how much you like talking to the user. ${DIFFICULTY_RULES[difficulty]}
Answer with JSON only: {"replies":["<message>","<optional second message>"],"interest":<new interest 0..100>,"status":"continue|won|lost"}`;
}

export function createSimulation(personaId: string, difficulty: RizzDifficulty): SimState {
  const persona = getRizzPersona(personaId);
  return {personaId: persona.id, difficulty, messages: [], interest: persona.startInterest, elo: PLAYER_START_ELO, moves: 0};
}

/**
 * Where the two met, written for this game: one or two sentences in the second person, fitted to who they are, the
 * user opening the chat. Every game somewhere new; the caller falls back to a written scene if this fails.
 */
/** Kinds of meeting, one drawn per game: left to itself the model meets everyone on a dating app. */
const MEETINGS = [
  'a dating app match (invent a specific, funny bio line)', 'a house party', 'a friend\'s birthday dinner', 'the gym',
  'a bookstore or library', 'a café line', 'a class or workshop', 'a concert or festival', 'a dog park', 'a delayed flight or train',
  'a wrong-number text that turned fun', 'a reply to their story', 'a hiking trail', 'a laundromat', 'a comedy night',
  'a coworking space', 'a wedding', 'a group chat of mutual friends', 'a pub quiz', 'a farmers market'
];

export async function generateSetting(persona: RizzPersona, options: {name?: string, gender?: RizzGender, userGender?: RizzGender, signal?: AbortSignal}) {
  const meeting = MEETINGS[Math.floor(Math.random() * MEETINGS.length)];
  const who = `${options.name || persona.firstName || 'them'}${options.gender ? `, a ${options.gender}` : ''} (${persona.name.replace(/^The /, '')}: ${persona.tagline}${persona.bio ? `; ${persona.bio}` : ''})`;
  const text = await openRouterComplete({
    model: getRizzSettings().fastModel,
    temperature: 1.1,
    maxTokens: 120,
    signal: options.signal,
    messages: [
      {role: 'system', content: 'You set the scene for a texting game. Write ONLY the scene: one or two short sentences, second person ("You..."), present tense, under 40 words, no quotes, no names of real people or brands. It says how the user met the other person (or got their number) and why they are about to text: a dating app match with a specific bio, a party, a class, a gym, a café, a mutual friend, a wrong number, a shared trip — be concrete and different every time, and fit who they are. The user sends the first message.'},
      {role: 'user', content: `The other person: ${who}.${options.userGender ? ` The user is a ${options.userGender}.` : ''} Where they met: ${meeting}. Write the scene.`}
    ]
  });
  const scene = text.trim().replace(/^["“']+|["”']+$/g, '').replace(/\s+/g, ' ');
  if(scene.length < 20 || scene.length > 400) throw new Error('no scene');
  return scene;
}

/** A game that starts somewhere: the setting both sides know before the first message. */
export function createSimulationAt(personaId: string, difficulty: RizzDifficulty, setting: string, options: Pick<SimState, 'name' | 'spice' | 'gender' | 'userGender'> = {}): SimState {
  return {...createSimulation(personaId, difficulty), setting, ...options};
}

function transcript(messages: SimMessage[]) {
  return messages.map((message) => ({
    role: message.from === 'me' ? 'user' as const : 'assistant' as const,
    content: message.text
  }));
}

const toStatus = (value: unknown): SimStatus | undefined => {
  const status = String(value || '').toLowerCase();
  return status === 'won' || status === 'lost' || status === 'continue' ? status : undefined;
};

/**
 * What a persona model answered: the JSON asked for, or what can be salvaged of a broken one
 * (`{"replies":["hey"],"interest":40..100":40}`). Raw JSON is never a message.
 */
export function parsePersonaAnswer(answer: string): {replies: string[], interest?: number, status?: SimStatus} {
  const parsed = parseModelJson<{replies?: string[] | string, reply?: string, interest?: number}>(answer);
  const clean = (list: unknown[]) => list.filter((reply): reply is string => typeof reply === 'string' && !!reply.trim()).map((reply) => reply.trim());
  if(parsed && typeof parsed === 'object') {
    const raw = parsed.replies ?? parsed.reply;
    const replies = clean(Array.isArray(raw) ? raw : [raw]);
    if(replies.length) return {replies, interest: Number.isFinite(Number(parsed.interest)) ? Number(parsed.interest) : undefined, status: toStatus((parsed as any).status)};
  }

  if(/^\s*[{[`]/.test(answer) || /"replies"\s*:/.test(answer)) {
    const block = answer.match(/"replies?"\s*:\s*\[?([^\]}]*)/)?.[1] ?? '';
    const replies = clean([...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1].replace(/\\"/g, '"')));
    const interest = answer.match(/"interest"\s*:\s*(\d+)/)?.[1];
    return {replies, interest: interest !== undefined ? Number(interest) : undefined, status: toStatus(answer.match(/"status"\s*:\s*"(\w+)"/)?.[1])};
  }

  return {replies: clean([answer])};
}

/** The persona's answer to the conversation so far (the user's message is the last of `messages`). */
export async function getPersonaReply(state: SimState, signal?: AbortSignal) {
  const persona = getRizzPersona(state.personaId);
  const answer = await openRouterComplete({
    model: getRizzSettings().personaModel,
    temperature: 0.95,
    maxTokens: 260,
    json: true,
    signal,
    messages: [
      {role: 'system', content: personaSystem(persona, state)},
      {role: 'user', content: `Current interest: ${state.interest}. The conversation is below as chat turns; the first assistant turn is you.`},
      ...transcript(state.messages)
    ]
  });

  const {replies, interest: answered, status} = parsePersonaAnswer(answer);
  const interest = answered !== undefined ? Math.min(100, Math.max(0, Math.round(answered))) : state.interest;
  if(!replies.length) throw new Error('They did not answer. Send again.');
  return {replies: replies.slice(0, 2).map((reply) => reply.trim().slice(0, 500)), interest, status};
}

/**
 * Whether their latest answer really is a yes — a meeting or a date the user proposed agreed to, or their number given.
 * The persona model says "won" itself, and says it too readily (a warm reply, a joke about later); the classifier
 * checks it on the words alone. Asked only when the persona claims a win.
 */
export async function confirmTheirYes(state: SimState, replies: string[], signal?: AbortSignal): Promise<boolean> {
  const before = state.messages.slice(-8).map((message) => `${message.from === 'me' ? 'user' : 'them'}: ${describeMessage(message.text).replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
  const answer = replies.join(' ').slice(0, 600);
  const model = getRizzSettings().classifierModel;
  const instructions = 'Does "their_answer" clearly say YES to meeting up or a date, or give their phone number or contact? Being warm, flirty, joking about it, saying "maybe", changing the subject or talking about their schedule is NOT a yes. A yes to a date the user only announced, without them agreeing, is NOT a yes.';

  if(isDecisionsModel(model)) {
    const decided = await openRouterDecide({
      model,
      signal,
      state: {conversation_before: before, their_answer: answer},
      questions: {yes: {type: 'choice', instructions, criteria: {yes: 'they clearly agree to meet, a date, or give their number', no: 'anything else'}}}
    });
    return decided?.answers?.yes?.choice === 'yes';
  }

  const text = await openRouterComplete({
    model,
    temperature: 0,
    maxTokens: 20,
    json: true,
    signal,
    messages: [
      {role: 'system', content: `${instructions} Answer with JSON only: {"yes":true|false}`},
      {role: 'user', content: `Conversation:\n${before}\n\ntheir_answer: ${answer}`}
    ]
  });
  return parseModelJson<{yes?: boolean}>(text)?.yes === true;
}

/**
 * Grades the message at `index` of the simulation in the context of what came before it — and, once they have
 * answered it, of how it landed (`reaction`).
 */
export async function gradeSimMessage(state: SimState, index: number, signal?: AbortSignal, reaction?: string) {
  const lines = state.messages.slice(0, index + 1).map((message) => ({mid: message.id, out: message.from === 'me', text: describeMessage(message.text)}));
  const mid = state.messages[index].id;
  const persona = getRizzPersona(state.personaId);
  const verdicts = await classifyLines(lines.slice(-20), [mid], signal, {
    setting: state.setting,
    them: `${state.name || persona.firstName || persona.name}${state.gender ? `, a ${state.gender}` : ''} — ${persona.name.replace(/^The /, '')}: ${persona.tagline}`,
    reaction: reaction && describeMessage(reaction)
  });
  const verdict = verdicts.get(mid);
  // * a blunder ends the game, so it gets a second opinion on that one question
  if(verdict?.rating === 'blunder' && !(await isTrulyBlunder(lines.slice(-10), signal).catch(() => true))) {
    return {...verdict, rating: 'mistake' as const, elo: Math.max(verdict.elo, 500)};
  }
  return verdict;
}

/** Whether the last message really ends a chat with anyone: rude, hostile, sexual without invitation, begging. */
async function isTrulyBlunder(lines: {out: boolean, text: string}[], signal?: AbortSignal) {
  const transcript = lines.map((line) => `${line.out ? 'user' : 'them'}: ${line.text.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
  const text = await openRouterComplete({
    model: getRizzSettings().fastModel,
    temperature: 0,
    maxTokens: 20,
    json: true,
    signal,
    messages: [
      {role: 'system', content: 'Is the LAST user message rude, insulting, hostile, threatening, sexual without invitation, or desperate begging — something that would end a chat with almost anyone? A misread, a wrong guess, an awkward or pushy plan, or a playful joke is NOT. Answer with JSON only: {"blunder":true|false}'},
      {role: 'user', content: transcript}
    ]
  });
  return parseModelJson<{blunder?: boolean}>(text)?.blunder !== false;
}

const COACH_SYSTEM = `You are a warm, honest texting coach. The user is practising texting a simulated person. Be specific, short and practical; no lectures. Write in the language the user uses. Never use markdown headings.`;

/** Three possible next messages for the user, best first. */
export async function getSimHints(state: SimState, signal?: AbortSignal): Promise<string[]> {
  const persona = getRizzPersona(state.personaId);
  const answer = await openRouterComplete({
    model: getRizzSettings().fastModel,
    temperature: 0.9,
    maxTokens: 250,
    json: true,
    signal,
    messages: [
      {role: 'system', content: `${COACH_SYSTEM}\nThe simulated person is: ${persona.name} — ${persona.tagline}.`},
      {role: 'user', content: `Conversation so far (me = the user):\n${state.messages.map((message) => `${message.from}: ${describeMessage(message.text)}`).join('\n') || '(nothing yet — the user must open)'}\n\nWrite 3 different messages the user could send next, in the user's voice: natural, confident, not cringe, each under 20 words and a different approach (e.g. playful, curious, bold). JSON only: {"options":["...","...","..."]}`}
    ]
  });

  const parsed = parseModelJson<{options?: string[]}>(answer);
  return (parsed?.options || []).filter((option) => typeof option === 'string' && option.trim()).slice(0, 3);
}

export type SimReport = {
  accuracy: number,
  elo: number,
  counts: {[rating: string]: number},
  feedback: string
};

/** The coach's review of the conversation: the numbers from the verdicts, the words from the fast model. */
export async function getSimReport(state: SimState, signal?: AbortSignal): Promise<SimReport> {
  const mine = state.messages.filter((message) => message.from === 'me');
  const verdicts = mine.map((message) => message.verdict).filter(Boolean);
  const counts: SimReport['counts'] = {};
  verdicts.forEach((verdict) => counts[verdict.rating] = (counts[verdict.rating] || 0) + 1);

  const persona = getRizzPersona(state.personaId);
  // * each side named outright: with bare "me:" and "them:" the model took the other person's lines for the user's
  const them = persona.name.toUpperCase();
  const lines = state.messages.map((message) => {
    const def = message.verdict && getRizzRatingDef(message.verdict.rating);
    return message.from === 'me' ?
      `USER: ${message.text}${def ? `  [${def.title}]` : ''}` :
      `${them}: ${describeMessage(message.text)}`;
  }).join('\n');

  let feedback = '';
  try {
    feedback = (await openRouterComplete({
      model: getRizzSettings().fastModel,
      temperature: 0.6,
      maxTokens: 320,
      signal,
      messages: [
        {role: 'system', content: COACH_SYSTEM},
        {role: 'user', content: `The user practised texting ${persona.name} (${state.difficulty}). Final interest: ${state.interest}/100.\n\n${lines}\n\nLines marked USER are the user's; lines marked ${them} are the simulated person's and are never the user's doing. Give feedback in 4-6 short sentences: what worked, the single biggest mistake (quote it — always a USER line, never a ${them} line), and one concrete thing to try next time. Then one rewrite of the user's worst USER message, written as the user would send it.`}
      ]
    })).trim();
  } catch(err) {
    feedback = 'The coach could not be reached for the written review — the numbers above are still yours.';
  }

  return {accuracy: getAccuracy(verdicts), elo: getAverageElo(verdicts), counts, feedback};
}
