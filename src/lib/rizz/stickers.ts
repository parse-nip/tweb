/*
 * What the simulated person can send besides words, as real people do: Telegram's own animated stickers (the ones
 * the app bundles: the duck, the monkey and friends) and big emoji. A sticker travels through the chat as the text
 * `sticker:<id>`; the models are told the set and what each one means, and read it back as a description.
 */

import type {LottieAssetName} from '@lib/lottie/lottieLoader';

export type RizzStickerId =
  'hi' | 'hmm' | 'bye' | 'party' | 'shy' | 'peek' | 'love' | 'wow' | 'gift' | 'stop' | 'cake' | 'chaos';

export const RIZZ_STICKERS: {[id in RizzStickerId]: {asset: LottieAssetName, meaning: string}} = {
  hi: {asset: 'UtyanDiscussion', meaning: 'a duck chatting away: hello, let\'s talk'},
  hmm: {asset: 'UtyanSearch', meaning: 'a duck searching with a magnifying glass: hmm, curious, suspicious'},
  bye: {asset: 'UtyanDisappear', meaning: 'a duck vanishing: I\'m out, bye'},
  party: {asset: 'Congratulations', meaning: 'confetti popper: yay, celebration'},
  shy: {asset: 'TwoFactorSetupMonkeyClose', meaning: 'a monkey covering its eyes: embarrassed, blushing 🙈'},
  peek: {asset: 'TwoFactorSetupMonkeyPeek', meaning: 'a monkey peeking through its fingers: intrigued, tell me more'},
  love: {asset: 'LoveLetter', meaning: 'a love letter: flirty, affection'},
  wow: {asset: 'Diamond', meaning: 'a sparkling diamond: impressed, that was smooth'},
  gift: {asset: 'Gift3', meaning: 'a gift box: something for you'},
  stop: {asset: 'hand_stop', meaning: 'a raised hand: stop, no, too much'},
  cake: {asset: 'Cake', meaning: 'a cake: treats, food, sweet'},
  chaos: {asset: 'jolly_roger', meaning: 'a pirate flag: chaos, mischief'}
};

const STICKER_RE = /^\s*\[?\s*sticker\s*:\s*([a-z_]+)\s*\]?\s*$/i;

/** The sticker a message is, if it is one. */
export function parseSticker(text: string): RizzStickerId | undefined {
  const id = text.match(STICKER_RE)?.[1]?.toLowerCase();
  return id && id in RIZZ_STICKERS ? id as RizzStickerId : undefined;
}

/** A message as a model reads it: a sticker as what it shows. */
export function describeMessage(text: string) {
  const sticker = parseSticker(text);
  return sticker ? `[sticker: ${RIZZ_STICKERS[sticker].meaning}]` : text;
}

/** For the persona's instructions: how to send one, and the set. */
export function stickerInstructions() {
  return `Stickers and emoji: like a real person you sometimes — not every message, maybe one in five — send a sticker instead of or after words, or react with just an emoji or two. To send a sticker, make that reply exactly "sticker:<id>" (on its own). The stickers: ${Object.entries(RIZZ_STICKERS).map(([id, sticker]) => `${id} (${sticker.meaning})`).join('; ')}.`;
}

/** A message that is only one to three emoji: Telegram shows it big, with no bubble. */
export function isBigEmoji(text: string) {
  const trimmed = text.trim();
  if(!trimmed || trimmed.length > 24) return false;
  if(!/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u.test(trimmed)) return false;
  const count = [...new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(trimmed.replace(/\s+/g, ''))].length;
  return count >= 1 && count <= 3 && !/^[\d#*\s]+$/.test(trimmed);
}
