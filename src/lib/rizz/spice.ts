/*
 * How spicy a message may be: what the ghost text suggests and how the simulated person flirts. Four steps, from
 * wholesome to suggestive; the top one is confident innuendo, never explicit — the models refuse that, and the
 * game is about texting well, not about getting graphic.
 */

export type RizzSpice = 0 | 1 | 2 | 3;

export const RIZZ_SPICE: {level: RizzSpice, title: string, prompt: string}[] = [
  {level: 0, title: 'Wholesome', prompt: 'Keep it wholesome: warm and friendly, no flirting beyond a light compliment.'},
  {level: 1, title: 'Flirty', prompt: 'Light flirting is welcome: playful teasing and compliments, nothing suggestive.'},
  {level: 2, title: 'Bold', prompt: 'Be boldly flirtatious: confident, direct about attraction, cheeky teasing, a little tension.'},
  {level: 3, title: 'Spicy', prompt: 'Be spicy: confident innuendo and suggestive banter are fine, but tasteful — never explicit or graphic.'}
];

export function getSpicePrompt(level: number) {
  return (RIZZ_SPICE.find((item) => item.level === level) || RIZZ_SPICE[1]).prompt;
}
