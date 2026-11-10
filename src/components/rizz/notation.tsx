/*
 * The game's notation, as chess.com lists the moves beside the board: every message of the player's numbered as a
 * move, with its badge, and their answer beside it. It opens as Telegram opens a chat's info — a column on the
 * right (over the chat on a phone); a click on a move brings its bubble into view.
 */

import {For, Show} from 'solid-js';
import type {SimMessage} from '@lib/rizz/simulator';
import {ButtonIconTsx} from '@components/buttonIconTsx';
import {Glyph, styles} from '@components/rizz/ui';
import classNames from '@helpers/string/classNames';

type Move = {mine?: SimMessage, theirs: SimMessage[]};

/** The chat as moves: a message of the player's, and everything they answered until the next one. */
function toMoves(messages: SimMessage[]) {
  const moves: Move[] = [];
  for(const message of messages) {
    if(message.from === 'me' || !moves.length) moves.push({mine: message.from === 'me' ? message : undefined, theirs: []});
    if(message.from === 'them') moves[moves.length - 1].theirs.push(message);
  }
  return moves;
}

export default function Notation(props: {
  messages: SimMessage[],
  /** the move (of the player's messages) selected, in a review */
  selected?: number,
  onPick: (move: number) => void,
  onClose: () => void
}) {
  const moves = () => toMoves(props.messages);
  let mineIndex = 0;

  return (
    <aside class={styles.notation} aria-label="Moves">
      <div class={styles.notationHeader}>
        <span class={styles.notationTitle}>Moves · {props.messages.filter((message) => message.from === 'me').length}</span>
        <ButtonIconTsx icon="close" aria-label="Close moves" onClick={props.onClose} />
      </div>
      <ol class={styles.notationList}>
        <For each={moves()}>{(move, index) => {
          const mine = move.mine ? mineIndex++ : undefined;
          return (
            <li>
              <button
                type="button"
                class={classNames(styles.notationMove, mine !== undefined && props.selected === mine && styles.notationSelected)}
                disabled={mine === undefined}
                onClick={() => mine !== undefined && props.onPick(mine)}
              >
                <span class={styles.notationNumber}>{index() + 1}.</span>
                <span class={styles.notationCell}>
                  <Show when={move.mine?.verdict}><Glyph verdict={move.mine.verdict} size={16} /></Show>
                  <span class={styles.notationText} dir="auto">{move.mine?.text || '…'}</span>
                </span>
                <span class={classNames(styles.notationCell, styles.notationTheirs)}>
                  <span class={styles.notationText} dir="auto">{move.theirs.map((message) => message.text).join(' · ')}</span>
                </span>
              </button>
            </li>
          );
        }}</For>
      </ol>
    </aside>
  );
}
