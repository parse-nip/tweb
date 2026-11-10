import type {RizzLine} from '@lib/rizz/classifier';
import {openRouterComplete} from '@lib/rizz/openrouter';
import {getRizzSettings} from '@lib/rizz/settings';
import {getSpicePrompt} from '@lib/rizz/spice';

const SYSTEM = `You ghostwrite text messages for the user ("me") in a chat with another person ("them"). You write ONLY the text of the message, nothing else: no quotes, no labels, no explanation, no emoji unless the chat already uses them.
Style: sound like the user, not like a poet or a pickup-line book. Short (under 20 words), natural, confident, warm, with a little personality or humour. Answer what they actually said, then move the conversation forward. Never be needy, creepy or try-hard. Write in the language of the conversation.`;

/**
 * A model asked to "continue" often starts by repeating the draft, whole or from its last words ("tea sounds good, tea
 * sounds good, what kind…"). The longest tail of the draft the answer begins with is dropped, so only the new words stay.
 */
export function stripDraftEcho(draft: string, text: string) {
  const typed = draft.replace(/\s+$/, '');
  if(!typed.trim()) return text;

  const norm = (value: string) => value.toLowerCase();
  const words = typed.split(/\s+/);
  // the whole draft first, then ever shorter tails of it (word-aligned)
  for(let start = 0; start < words.length; ++start) {
    const tail = words.slice(start).join(' ');
    if(tail.length >= 2 && norm(text).startsWith(norm(tail)) && (start === 0 || tail.length >= 4)) {
      return text.slice(tail.length).replace(/^[\s]+(?=[^\s.,!?;:)\]])/, ' ');
    }
  }

  // the model wrote its own words first and the draft after them: what follows the draft is the continuation
  const at = norm(text).indexOf(norm(typed));
  if(at > 0) return text.slice(at + typed.length);

  return text;
}

export type RizzSuggestionArgs = {
  lines: RizzLine[],
  /** what the user has typed; empty to get a whole reply */
  draft: string,
  /** how spicy the suggestion may be (`@lib/rizz/spice`); the default is flirty */
  spice?: number,
  signal?: AbortSignal
};

/**
 * Ghost text for the composer: how the draft goes on (a continuation that is appended to it), or, for an empty
 * draft, a whole reply. Returned as it is to be inserted: with the space that joins it to the draft where needed.
 */
export async function getRizzSuggestion({lines, draft, spice, signal}: RizzSuggestionArgs) {
  const history = lines.slice(-14).map((line) => `${line.out ? 'me' : 'them'}: ${line.text.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n');
  const task = draft.trim() ?
    `The user has started typing: "${draft}"\nWrite ONLY the words that come AFTER it, to be appended right after the typed text. Do NOT repeat, quote or rephrase anything already typed: your answer must start with the first new word. Finish the thought in a way that lands well.` :
    'Write the best next message from the user.';

  let text = (await openRouterComplete({
    model: getRizzSettings().fastModel,
    temperature: 0.8,
    maxTokens: 80,
    signal,
    messages: [
      {role: 'system', content: spice === undefined ? SYSTEM : `${SYSTEM}\n${getSpicePrompt(spice)}`},
      {role: 'user', content: `Conversation (oldest first):\n${history || '(empty)'}\n\n${task}`}
    ]
  })).trim().replace(/^["“'`]+|["”'`]+$/g, '').replace(/\n+/g, ' ');

  const continuation = draft.trim() ? stripDraftEcho(draft, text).replace(/^\s+(?=[.,!?;:)\]])/, '') : text;
  if(!continuation.trim()) return '';
  text = continuation;
  // join it to the draft: a space unless the draft already ends in one or the continuation starts with punctuation
  const needsSpace = !!draft && !/\s$/.test(draft) && !/^[\s.,!?;:)\]]/.test(text);
  return (needsSpace ? ' ' : '') + text;
}
