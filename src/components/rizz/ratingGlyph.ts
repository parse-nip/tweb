import type {RizzRatingDef} from '@lib/rizz/ratings';

const NS = 'http://www.w3.org/2000/svg';

/**
 * What a badge of `def` shows: its drawing (an svg, so it looks the same on every platform) or its text.
 * The svg markup is this package's own constants (src/lib/rizz/ratings.ts), never a model's.
 */
export default function createRatingGlyph(def: RizzRatingDef): SVGSVGElement | Text {
  if(!def.svg) return document.createTextNode(def.symbol);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.color = def.color;
  svg.innerHTML = def.svg;
  return svg;
}
