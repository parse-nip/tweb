/*
 * Game Review: the conversation replayed with each reply classified; the summary — accuracy, game
 * rating, the vibe graph, the classifications — as the card the chat opens with; the coach on the
 * selected reply as a pinned bar, with the engine's best move and a retry.
 */

import {createEffect, createMemo, createSignal, For, on, onCleanup, Show} from 'solid-js';
import {
  CLASSIFICATION_ORDER, CLASSIFICATIONS, classifyMove, endingMessage, getScenario, optionOrder, summarizeGame,
  winProbability
} from '@components/rizz/engine';
import {navigate} from '@components/rizz/router';
import {getGame} from '@components/rizz/store';
import {
  ActionPlate, answerVerdict, Avatar, BubbleData, ClassDot, Graph, Messages, PinnedBar, ReplyKeyboard, signed, styles,
  Topbar, VibeLine
} from '@components/rizz/ui';

export default function ReviewScreen(props: {gameId: string}) {
  const game = getGame(props.gameId);
  if(!game) {
    return <div class={styles.emptyPill}>This game is no longer in your archive</div>;
  }

  const scenario = getScenario(game.scenarioId);
  const summary = summarizeGame(game.moves);
  const [selected, setSelected] = createSignal(0);
  // * retrying the selected move: undefined — not retrying, -1 — choosing, else the pick
  const [retry, setRetry] = createSignal<number>();

  const items = createMemo<BubbleData[]>(() => {
    const list: BubbleData[] = [];
    game.moves.forEach((move) => {
      if(move.them) list.push({text: move.them});
      list.push({text: scenario.turns[move.turn].options[move.option].text, out: true, classification: move.classification});
    });
    const ending = endingMessage(game);
    if(ending) list.push({text: ending});
    return list;
  });

  // the bubble index of each move, for selection
  const outIndexes = createMemo(() => items().map((item, index) => item.out ? index : -1).filter((index) => index !== -1));

  const move = () => game.moves[selected()];
  const turn = () => move() && scenario.turns[move().turn];
  const chosen = () => turn().options[move().option];

  const select = (index: number) => {
    setSelected(Math.max(0, Math.min(game.moves.length - 1, index)));
    setRetry(undefined);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if((e.target as HTMLElement)?.closest?.('input, textarea')) return;
    // * moves are a sequence in time: the next one is at the inline end
    const rtl = document.documentElement.dir === 'rtl';
    if(e.key === 'ArrowRight') select(selected() + (rtl ? -1 : 1));
    else if(e.key === 'ArrowLeft') select(selected() + (rtl ? 1 : -1));
  };
  document.addEventListener('keydown', onKeyDown);
  onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  let scrollEl: HTMLDivElement;
  // * the selected reply is brought into view as the review steps through the game
  createEffect(on(selected, (index) => {
    const bubble = scrollEl?.querySelectorAll<HTMLElement>(`.${styles.out}`)[index];
    bubble?.scrollIntoView({block: 'center', behavior: 'smooth'});
  }, {defer: true}));

  const probability = () => winProbability(move() ? move().evalAfter : 0);
  const verdict = () => retry() >= 0 && answerVerdict(turn(), retry());

  return (
    <>
      <Topbar
        media={<Avatar name={game.opponent.name} color={game.opponent.color} size={42} />}
        title={`Game Review · ${game.opponent.name}`}
        subtitle={`${scenario.title} · ${game.result === 'win' ? 'won' : game.result === 'draw' ? 'draw' : 'lost'} · move ${selected() + 1} of ${game.moves.length}`}
        onBack={() => navigate({name: 'archive'})}
      />
      <VibeLine probability={probability()} />
      <Show when={move()}>
        <Show when={retry() === undefined} fallback={
          <PinnedBar
            title={verdict() ? <><ClassDot classification={classifyMove(turn(), turn().options[retry()])} /> {verdict().right ? 'That\'s the best move' : CLASSIFICATIONS[classifyMove(turn(), turn().options[retry()])].label}</> : 'Retry: find the best reply'}
            muted={verdict() && !verdict().right ? `Best: “${verdict().best.text}”` : undefined}
          >
            {verdict() ? turn().options[retry()].why : `They said: “${move().them || scenario.setting}”`}
          </PinnedBar>
        }>
          <PinnedBar
            title={<><ClassDot classification={move().classification} /> {CLASSIFICATIONS[move().classification].label} · vibe {signed(move().delta)}</>}
            muted={chosen() !== answerVerdict(turn(), move().option).best ? `Best was: “${answerVerdict(turn(), move().option).best.text}”` : undefined}
          >
            {chosen().why}
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
          <div class={styles.introTitle}>{scenario.title}</div>
          <div class={styles.statsGrid} style={{'grid-template-columns': game.ratingAfter !== undefined ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'}}>
            <div>
              <div class={styles.statValue}>{summary.accuracy.toFixed(1)}</div>
              <div class={styles.statLabel}>Accuracy</div>
            </div>
            <div>
              <div class={styles.statValue}>{game.gameRating}</div>
              <div class={styles.statLabel}>Game rating</div>
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
          <Graph values={[0, ...game.moves.map((move) => move.evalAfter)]} center={0} highlight={selected() + 1} onPick={(index) => index > 0 && select(index - 1)} />
          <div class={styles.counts}>
            <For each={CLASSIFICATION_ORDER.filter((key) => summary.counts[key])}>{(key) => (
              <span class={styles.count}><ClassDot classification={key} /> {summary.counts[key]} {CLASSIFICATIONS[key].label}</span>
            )}</For>
          </div>
        </>}
      />
      <div class={styles.composer}>
        <Show when={move()}>
          <ActionPlate
            label={retry() === undefined ? 'Retry this move' : 'Back to the coach'}
            onClick={() => setRetry(retry() === undefined ? -1 : undefined)}
            left={{icon: 'previous', label: 'Previous move', onClick: () => select(selected() - 1)}}
            right={{icon: 'next', label: 'Next move', onClick: () => select(selected() + 1)}}
          />
          <Show when={retry() === -1}>
            <ReplyKeyboard
              options={optionOrder(turn(), game.seed + move().turn).map((index) => ({text: turn().options[index].text, index}))}
              onPick={(index) => setRetry(index)}
            />
          </Show>
        </Show>
      </div>
    </>
  );
}
