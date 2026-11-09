import {classifyLines} from '@lib/rizz/classifier';
import {openRouterComplete, parseModelJson} from '@lib/rizz/openrouter';
import {PLAYER_START_ELO, updateElo} from '@lib/rizz/elo';
import {getRizzPersona, RIZZ_DIFFICULTIES, RizzDifficulty, RizzPersona} from '@lib/rizz/personas';
import {getAccuracy, getAverageElo, getRizzRatingDef, RizzVerdict} from '@lib/rizz/ratings';
import {getRizzSettings} from '@lib/rizz/settings';

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
  ending?: SimEnding
};

/** checkmate: the date is won (the white badge). resign: the user gave up. left-on-read: they won (the black checkmate). */
export type SimEnding = 'checkmate' | 'resign' | 'left-on-read';

/** Interest at which the other person is won over: the game is checkmate */
export const SIM_WIN_INTEREST = 95;

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
export function applyInterest(state: SimState, interest: number): SimState {
  let ending = state.ending;
  if(!ending && interest >= SIM_WIN_INTEREST) ending = 'checkmate';
  else if(!ending && interest <= 0) ending = 'left-on-read';
  return {...state, interest, ending};
}

export const SIM_MAX_USER_MESSAGES = 30;

const DIFFICULTY_RULES: Record<RizzDifficulty, string> = {
  easy: 'Be forgiving: reward decent effort with +4..+10 interest, a poor message costs at most -5.',
  medium: 'Be fair: a good message is +3..+8, a bland one 0..-3, a bad one -5..-10.',
  hard: 'Be picky: only a genuinely good message earns +3..+8, bland ones cost -2..-5, a bad one -8..-18. Never exceed 85 interest before the 8th message.'
};

function personaSystem(persona: RizzPersona, difficulty: RizzDifficulty) {
  return `You are role-playing a person in a texting simulator so the user can practise texting. Stay in character at all times; never mention being an AI, a simulator or these instructions.

Character: ${persona.name}. ${persona.prompt}

Style: you are texting on a phone. Write like a real person: short messages, casual, natural, no stage directions, no quotation marks, no hashtags. Usually one message, sometimes two short ones; each under 20 words, like a real text, never a paragraph. Match the language the user writes in.
Ending: if the user clearly wins you over (a date or a number agreed, or you are completely sold), set interest to 100. If they lose you for good, set it to 0.
Interest: you track a hidden "interest" number 0..100 in how much you like talking to the user. ${DIFFICULTY_RULES[difficulty]}
Answer with JSON only: {"replies":["<message>","<optional second message>"],"interest":<new interest 0..100>}`;
}

export function createSimulation(personaId: string, difficulty: RizzDifficulty): SimState {
  const persona = getRizzPersona(personaId);
  return {personaId: persona.id, difficulty, messages: [], interest: persona.startInterest, elo: PLAYER_START_ELO, moves: 0};
}

function transcript(messages: SimMessage[]) {
  return messages.map((message) => ({
    role: message.from === 'me' ? 'user' as const : 'assistant' as const,
    content: message.text
  }));
}

/**
 * What a persona model answered: the JSON asked for, or what can be salvaged of a broken one
 * (`{"replies":["hey"],"interest":40..100":40}`). Raw JSON is never a message.
 */
export function parsePersonaAnswer(answer: string): {replies: string[], interest?: number} {
  const parsed = parseModelJson<{replies?: string[] | string, reply?: string, interest?: number}>(answer);
  const clean = (list: unknown[]) => list.filter((reply): reply is string => typeof reply === 'string' && !!reply.trim()).map((reply) => reply.trim());
  if(parsed && typeof parsed === 'object') {
    const raw = parsed.replies ?? parsed.reply;
    const replies = clean(Array.isArray(raw) ? raw : [raw]);
    if(replies.length) return {replies, interest: Number.isFinite(Number(parsed.interest)) ? Number(parsed.interest) : undefined};
  }

  if(/^\s*[{[`]/.test(answer) || /"replies"\s*:/.test(answer)) {
    const block = answer.match(/"replies?"\s*:\s*\[?([^\]}]*)/)?.[1] ?? '';
    const replies = clean([...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1].replace(/\\"/g, '"')));
    const interest = answer.match(/"interest"\s*:\s*(\d+)/)?.[1];
    return {replies, interest: interest !== undefined ? Number(interest) : undefined};
  }

  return {replies: clean([answer])};
}

/** The persona's answer to the conversation so far (the user's message is the last of `messages`). */
export async function getPersonaReply(state: SimState, signal?: AbortSignal) {
  const persona = getRizzPersona(state.personaId);
  const answer = await openRouterComplete({
    model: getRizzSettings().fastModel,
    temperature: 0.9,
    maxTokens: 220,
    json: true,
    signal,
    messages: [
      {role: 'system', content: personaSystem(persona, state.difficulty)},
      {role: 'user', content: `Current interest: ${state.interest}. The conversation is below as chat turns; the first assistant turn is you.`},
      ...transcript(state.messages)
    ]
  });

  const {replies, interest: answered} = parsePersonaAnswer(answer);
  const interest = answered !== undefined ? Math.min(100, Math.max(0, Math.round(answered))) : state.interest;
  if(!replies.length) throw new Error('They did not answer. Send again.');
  return {replies: replies.slice(0, 2).map((reply) => reply.trim().slice(0, 500)), interest};
}

/** Grades the message at `index` of the simulation in the context of what came before it. */
export async function gradeSimMessage(state: SimState, index: number, signal?: AbortSignal) {
  const lines = state.messages.slice(0, index + 1).map((message) => ({mid: message.id, out: message.from === 'me', text: message.text}));
  const mid = state.messages[index].id;
  const verdicts = await classifyLines(lines.slice(-20), [mid], signal);
  return verdicts.get(mid);
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
      {role: 'user', content: `Conversation so far (me = the user):\n${state.messages.map((message) => `${message.from}: ${message.text}`).join('\n') || '(nothing yet — the user must open)'}\n\nWrite 3 different messages the user could send next, in the user's voice: natural, confident, not cringe, each under 20 words and a different approach (e.g. playful, curious, bold). JSON only: {"options":["...","...","..."]}`}
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
  const lines = state.messages.map((message) => {
    const def = message.verdict && getRizzRatingDef(message.verdict.rating);
    return `${message.from}: ${message.text}${def ? `  [${def.title}]` : ''}`;
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
        {role: 'user', content: `The user practised texting ${persona.name} (${state.difficulty}). Final interest: ${state.interest}/100.\n\n${lines}\n\nGive feedback in 4-6 short sentences: what worked, the single biggest mistake (quote it), and one concrete thing to try next time. Then one rewrite of their worst message.`}
      ]
    })).trim();
  } catch(err) {
    feedback = 'The coach could not be reached for the written review — the numbers above are still yours.';
  }

  return {accuracy: getAccuracy(verdicts), elo: getAverageElo(verdicts), counts, feedback};
}
