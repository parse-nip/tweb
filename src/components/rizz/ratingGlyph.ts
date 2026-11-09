import type {RizzRatingDef} from '@lib/rizz/ratings';

// the badges' drawings, one file per label (a round badge with its glyph, 18x19 with its shadow)
const ICONS = import.meta.glob<string>('./icons/*.svg', {eager: true, query: '?url', import: 'default'});

const getIconUrl = (name: string) => ICONS[`./icons/${name}.svg`];

/**
 * The whole badge of `def`: the drawing carries its own colour and shadow. Checkmate and resign have a white and
 * a black version; `dark` picks the black one (the other person's).
 */
export default function createRatingGlyph(def: RizzRatingDef, dark = false) {
  const image = document.createElement('img');
  const variant = dark && (def.id === 'checkmate' || def.id === 'resign') ? def.id + '-black' : def.id;
  image.src = getIconUrl(variant) || getIconUrl(def.id);
  image.alt = '';
  image.draggable = false;
  image.setAttribute('aria-hidden', 'true');
  return image;
}
