/*
 * What the badges mean: every label the Coach gives, with its drawing and what it stands for — in a Telegram popup,
 * from the ⓘ in a game's header and in its review.
 */

import {For} from 'solid-js';
import PopupElement, {createPopup} from '@components/popups/indexTsx';
import {RIZZ_RATINGS} from '@lib/rizz/ratings';
import {Glyph, styles} from '@components/rizz/ui';

export default function showBadgeLegend() {
  createPopup(() => (
    <PopupElement class={styles.legendPopup} closable>
      <PopupElement.Header>
        <PopupElement.CloseButton />
        <PopupElement.Title>What the badges mean</PopupElement.Title>
      </PopupElement.Header>
      <PopupElement.Body>
        <ul class={styles.legend}>
          <For each={RIZZ_RATINGS}>{(def) => (
            <li class={styles.legendRow}>
              <Glyph verdict={def.id} size={28} />
              <span>
                <b>{def.title}</b>
                <span class={styles.legendHint}>{def.hint.charAt(0).toUpperCase() + def.hint.slice(1)}.</span>
              </span>
            </li>
          )}</For>
        </ul>
      </PopupElement.Body>
    </PopupElement>
  ));
}
