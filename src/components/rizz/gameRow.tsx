/*
 * A finished game as a chat of the list: the opponent, the last message (yours prefixed "You:", as Telegram writes
 * it), the day, and the result as the Coach's drawing — the white checkmate for a date, the black one for being left
 * on read, the flag for a resignation. A click opens its review.
 */

import {Show} from 'solid-js';
import {navigate} from '@components/rizz/router';
import type {RizzGameRecord} from '@components/rizz/store';
import {Avatar, Glyph, ListRow, styles} from '@components/rizz/ui';

function lastLine(game: RizzGameRecord) {
  const last = game.messages[game.messages.length - 1];
  if(!last) return 'No messages';
  return (last.from === 'me' ? 'You: ' : '') + last.text;
}

function when(date: number) {
  const day = new Date(date);
  const today = new Date();
  return day.toDateString() === today.toDateString() ?
    `${day.getHours()}:${String(day.getMinutes()).padStart(2, '0')}` :
    day.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

export function ResultGlyph(props: {game: RizzGameRecord}) {
  return (
    <span class={styles.resultGlyph} title={props.game.result === 'win' ? 'A date' : props.game.result === 'draw' ? 'Draw' : props.game.reason === 'blunder' ? 'Blundered' : 'Lost'}>
      <Show when={props.game.result !== 'draw'} fallback={<span class={styles.rowMeta}>½</span>}>
        <Glyph
          verdict={props.game.reason === 'resigned' ? 'resign' : props.game.reason === 'blunder' ? 'blunder' : 'checkmate'}
          dark={props.game.result === 'loss'}
          size={20}
        />
      </Show>
    </span>
  );
}

export default function GameRow(props: {game: RizzGameRecord, active?: boolean, small?: boolean}) {
  return (
    <ListRow
      small={props.small}
      active={props.active}
      media={<Avatar name={props.game.opponent.name} color={props.game.opponent.color} size={props.small ? 42 : 54} />}
      title={props.game.opponent.name}
      subtitle={lastLine(props.game)}
      meta={when(props.game.date)}
      badge={<ResultGlyph game={props.game} />}
      onClick={() => navigate({name: 'review', gameId: props.game.id})}
    />
  );
}
