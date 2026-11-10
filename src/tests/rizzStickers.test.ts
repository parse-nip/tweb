import {describe, expect, it} from 'vitest';
import {describeMessage, isBigEmoji, parseSticker} from '@lib/rizz/stickers';

describe('rizz stickers and big emoji', () => {
  it('reads a sticker the persona sends, and nothing else', () => {
    expect(parseSticker('sticker:shy')).toBe('shy');
    expect(parseSticker(' [sticker: LOVE] ')).toBe('love');
    expect(parseSticker('sticker:unknown')).toBeUndefined();
    expect(parseSticker('I love stickers: shy ones')).toBeUndefined();
    expect(describeMessage('sticker:stop')).toMatch(/^\[sticker: a raised hand/);
    expect(describeMessage('hello')).toBe('hello');
  });

  it('draws one to three emoji big', () => {
    expect(isBigEmoji('😂')).toBe(true);
    expect(isBigEmoji('🙈🙈🙈')).toBe(true);
    expect(isBigEmoji('👍🏽')).toBe(true);
    expect(isBigEmoji('😂😂😂😂')).toBe(false);
    expect(isBigEmoji('lol 😂')).toBe(false);
    expect(isBigEmoji('123')).toBe(false);
  });
});
