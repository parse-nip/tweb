/*
 * Game Review: the chat replayed with the Coach's label on every message of the player's; the summary — accuracy,
 * the messages' Elo, the interest graph, the labels, and the Coach's written review (`getSimReport`) — as the card
 * the chat opens with; the selected message's verdict pinned above, and a retry: write it again, and the Coach
 * grades the new one in the same place.
 */

import {createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show} from 'solid-js';
import {getSimReport, SimState} from '@lib/rizz/simulator';
import {classifyLines} from '@lib/rizz/classifier';
import {getRizzRatingDef, RIZZ_RATINGS, RizzVerdict} from '@lib/rizz/ratings';
import {navigate} from '@components/rizz/router';
import {getGame, profile, setProfile} from '@components/rizz/store';
import {
  ActionPlate, Avatar, BubbleData, Glyph, Graph, Messages, PinnedBar, signed, styles, Topbar, VibeLine
} from '@components/rizz/ui';
import Composer from '@components/rizz/composer';
import {ButtonIconTsx} from '@components/buttonIconTsx';

export default function ReviewScreen(props: {gameId: string}) {
  const game = getGame(props.gameId);
  if(!game) {
    return <div class={styles.emptyPill}>This game is no longer in your archive</div>;
  }

  const mine = game.messages.filter((message) => message.from === 'me');
  const [selected, setSelected] = createSignal(0);
  // * retrying the selected message: undefined — not retrying, null — writing, else the new one's verdict
  const [retry, setRetry] = createSignal<{text?: string, verdict?: RizzVerdict, grading?: boolean} | null>();
  const [feedback, setFeedback] = createSignal(game.coachReview);

  const items = createMemo<BubbleData[]>(() => game.messages.map((message) => ({
    text: message.text,
    out: message.from === 'me',
    verdict: message.verdict,
    delta: message.delta
  })));

  const outIndexes = createMemo(() => items().map((item, index) => item.out ? index : -1).filter((index) => index !== -1));
  const message = () => mine[selected()];

  const select = (index: number) => {
    setSelected(Math.max(0, Math.min(mine.length - 1, index)));
    setRetry(undefined);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if((e.target as HTMLElement)?.closest?.('input, textarea')) return;
    // * messages are a sequence in time: the next one is at the inline end
    const rtl = document.documentElement.dir === 'rtl';
    if(e.key === 'ArrowRight') select(selected() + (rtl ? -1 : 1));
    else if(e.key === 'ArrowLeft') select(selected() + (rtl ? 1 : -1));
  };
  document.addEventListener('keydown', onKeyDown);
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  let scrollEl: HTMLDivElement;
  // * the selected message is brought into view as the review steps through the game
  createEffect(on(selected, (index) => {
    scrollEl?.querySelectorAll<HTMLElement>(`.${styles.out}`)[index]?.scrollIntoView({block: 'center', behavior: 'smooth'});
  }, {defer: true}));

  /** The chat before the selected message, as the classifier reads it. */
  const linesBefore = () => {
    const index = game.messages.indexOf(message());
    return game.messages.slice(0, index).map((item) => ({mid: item.id, out: item.from === 'me', text: item.text}));
  };

  const gradeRetry = async(text: string) => {
    setRetry({text, grading: true});
    const lines = [...linesBefore(), {mid: 1e9, out: true, text}];
    try {
      const verdicts = await classifyLines(lines.slice(-20), [1e9]);
      setRetry({text, verdict: verdicts.get(1e9)});
    } catch(err) {
      setRetry({text});
    }
  };

  // * the Coach's written review: asked for once, kept with the game
  onMount(async() => {
    if(feedback() || !mine.length) return;
    const state: SimState = {
      personaId: game.opponent.personaId,
      difficulty: game.opponent.difficulty,
      messages: game.messages,
      interest: game.interest[game.interest.length - 1] ?? 50,
      elo: game.gameRating,
      moves: mine.length
    };
    const report = await getSimReport(state).catch((): undefined => undefined);
    if(!report?.feedback) return;
    setFeedback(report.feedback);
    setProfile('games', (item) => item.id === game.id, 'coachReview', report.feedback);
  });

  const counts = createMemo(() => RIZZ_RATINGS.map((def) => ({def, count: mine.filter((item) => item.verdict?.rating === def.id).length})).filter((item) => item.count));
  const interest = () => game.interest[selected()] ?? game.interest[game.interest.length - 1] ?? 50;

  return (
    <>
      <Topbar
        media={<Avatar name={game.opponent.name} color={game.opponent.color} size={42} />}
        title={`Game Review · ${game.opponent.name}`}
        subtitle={`${game.result === 'win' ? 'checkmate' : game.result === 'draw' ? 'draw' : 'lost'} · message ${selected() + 1} of ${mine.length}`}
        onBack={() => navigate({name: 'archive'})}
      />
      <VibeLine probability={interest() / 100} />
      <Show when={message()}>
        <Show when={retry() === undefined} fallback={
          <PinnedBar
            title={retry()?.verdict ?
              <><Glyph verdict={retry().verdict} /> {getRizzRatingDef(retry().verdict.rating).title} · ~{retry().verdict.elo} Elo</> :
              retry()?.grading ? 'Grading…' : 'Retry: write it again'}
            muted={retry()?.text ? `You: “${retry().text}”` : `Was: “${message().text}”`}
          >
            {retry()?.verdict?.reason || (retry()?.grading ? 'The coach is reading your new message.' : 'What would you send here instead?')}
          </PinnedBar>
        }>
          <PinnedBar
            title={message().verdict ?
              <><Glyph verdict={message().verdict} /> {getRizzRatingDef(message().verdict.rating).title} · ~{message().verdict.elo} Elo{message().delta !== undefined ? ` · ${signed(message().delta)}` : ''}</> :
              'Not graded'}
          >
            {message().verdict?.reason || 'The coach could not grade this message.'}
          </PinnedBar>
        </Show>
      </Show>
      <Messages
        ref={(el) => scrollEl = el}
        stickToEnd={false}
        items={items()}
        selectedIndex={outIndexes()[selected()]}
        onSelect={(index) => select(outIndexes().indexOf(index))}
        intro={<>
          <div class={styles.introTitle}>vs {game.opponent.name}</div>
          <div class={styles.statsGrid} style={{'grid-template-columns': game.ratingAfter !== undefined ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'}}>
            <div>
              <div class={styles.statValue}>{game.accuracy}</div>
              <div class={styles.statLabel}>Accuracy</div>
            </div>
            <div>
              <div class={styles.statValue}>{game.gameRating}</div>
              <div class={styles.statLabel}>Avg. Elo</div>
            </div>
            <Show when={game.ratingAfter !== undefined}>
              <div>
                <div class={styles.statValue} classList={{[styles.up]: game.ratingAfter > game.ratingBefore, [styles.down]: game.ratingAfter < game.ratingBefore}}>
                  {signed(game.ratingAfter - game.ratingBefore)}
                </div>
                <div class={styles.statLabel}>Rating</div>
              </div>
            </Show>
          </div>
          <Show when={game.interest.length > 1}>
            <Graph values={game.interest} center={50} highlight={selected()} onPick={select} />
          </Show>
          <div class={styles.counts}>
            <For each={counts()}>{(item) => (
              <span class={styles.count}><Glyph verdict={item.def.id} size={18} /> {item.count} {item.def.title}</span>
            )}</For>
          </div>
          <div class={styles.coachReview}>{feedback() || 'The coach is writing your review…'}</div>
        </>}
      />
      <div class={styles.composer}>
        <Show when={message()}>
          <Show when={retry() === null || retry()?.verdict || retry()?.text} fallback={
            <ActionPlate
              label="Retry this message"
              onClick={() => setRetry(null)}
              left={{icon: 'previous', label: 'Previous message', onClick: () => select(selected() - 1)}}
              right={{icon: 'next', label: 'Next message', onClick: () => select(selected() + 1)}}
            />
          }>
            <Composer
              placeholder="Write it again…"
              lines={linesBefore}
              ghost={profile.settings.ghost}
              disabled={retry()?.grading}
              onSend={gradeRetry}
              right={<ButtonIconTsx icon="close" aria-label="Back to the review" onClick={() => setRetry(undefined)} />}
            />
          </Show>
        </Show>
      </div>
    </>
  );
}

