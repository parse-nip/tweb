/*
 * The game's dialogs, on Telegram's popup: the end of a game (with its confetti on a date), and a
 * confirmation.
 */

import {onMount, Show} from 'solid-js';
import PopupElement, {createPopup} from '@components/popups/indexTsx';
import confirmationPopup from '@components/confirmationPopup';
import {ConfettiContainer, ConfettiRef} from '@components/confetti';
import liteMode from '@helpers/liteMode';
import classNames from '@helpers/string/classNames';
import {RizzGameRecord} from '@components/rizz/store';
import {Avatar, signed, styles} from '@components/rizz/ui';

const RESULT_COPY = {
  date: {emoji: '💘', title: 'It\'s a date!'},
  friendzone: {emoji: '🤝', title: 'Friendzoned'},
  agreed: {emoji: '🤝', title: 'Just friends'},
  ghosted: {emoji: '👻', title: 'Ghosted'},
  timeout: {emoji: '⌛', title: 'Left on read'},
  resigned: {emoji: '🏳️', title: 'You unmatched'}
};

export function confirmAction(options: {title: string, description: string, button: string, danger?: boolean}) {
  return confirmationPopup({
    title: options.title,
    descriptionRaw: options.description,
    button: {text: document.createTextNode(options.button), isDanger: options.danger}
  }).then(() => true, () => false);
}

export function showGameResult(record: RizzGameRecord, actions: {
  onReview: () => void,
  onRematch: () => void,
  onNew: () => void
}) {
  const copy = RESULT_COPY[record.reason];
  const delta = record.ratingAfter !== undefined ? record.ratingAfter - record.ratingBefore : undefined;
  let confetti: ConfettiRef;

  createPopup(() => {
    onMount(() => {
      if(record.result === 'win' && liteMode.isAvailable('animations')) {
        setTimeout(() => confetti?.create({mode: 'poppers', count: 120}), 150);
      }
    });

    return (
      <PopupElement class={styles.resultPopupRoot} closable>
        <PopupElement.Header>
          <PopupElement.CloseButton />
          <PopupElement.Title>{copy.title}</PopupElement.Title>
        </PopupElement.Header>
        <PopupElement.Body>
          <div class={styles.resultPopup}>
            <div class={styles.profileHeader}>
              <Avatar name={record.opponent.name} color={record.opponent.color} size={80} />
              <div class={styles.profileName}>{copy.emoji} {record.opponent.name}</div>
              <div class={styles.profileStatus}>
                {record.result === 'win' ? 'You won' : record.result === 'draw' ? 'A draw' : 'You lost'} · {record.opponent.rating}
              </div>
            </div>
            <div class={styles.statsGrid} style={{'grid-template-columns': delta !== undefined ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'}}>
              <div>
                <div class={styles.statValue}>{record.accuracy.toFixed(1)}</div>
                <div class={styles.statLabel}>Accuracy</div>
              </div>
              <div>
                <div class={styles.statValue}>{record.gameRating}</div>
                <div class={styles.statLabel}>Game rating</div>
              </div>
              <Show when={delta !== undefined}>
                <div>
                  <div class={classNames(styles.statValue, delta > 0 && styles.up, delta < 0 && styles.down)}>{record.ratingAfter}</div>
                  <div class={styles.statLabel}>Rating {signed(delta)}</div>
                </div>
              </Show>
            </div>
          </div>
          <ConfettiContainer ref={(ref) => confetti = ref} class={styles.confetti} />
        </PopupElement.Body>
        <PopupElement.Footer>
          <PopupElement.FooterButton callback={actions.onReview}>Game Review</PopupElement.FooterButton>
          <PopupElement.FooterButton color="secondary" callback={actions.onRematch}>Rematch</PopupElement.FooterButton>
          <PopupElement.FooterButton color="secondary" callback={actions.onNew}>New opponent</PopupElement.FooterButton>
        </PopupElement.Footer>
      </PopupElement>
    );
  });
}
