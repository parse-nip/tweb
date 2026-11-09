/*
 * Puzzles: a conversation cut at a decision, find the best reply. Rated puzzles move the puzzle
 * rating; the Daily Puzzle keeps a streak; Puzzle Rush is three minutes and three strikes.
 */

import {createMemo, createSignal, JSX, onCleanup, Show} from 'solid-js';
import {
  classifyMove, dailyPuzzle, dayKey, isPuzzleSolved, optionOrder, pickPuzzle, puzzleTurn, RizzPuzzle, rushLadder,
  updateRating
} from '@components/rizz/engine';
import {profile, pushRating, setProfile} from '@components/rizz/store';
import {addTrophies, TROPHIES} from '@components/rizz/world';
import {
  ActionPlate, answerVerdict, Avatar, Block, ClassDot, createNow, formatClock, InputBox, Messages, Page, PinnedBar,
  ReplyKeyboard, signed, styles, Topbar
} from '@components/rizz/ui';
import Button from '@components/buttonTsx';
import classNames from '@helpers/string/classNames';

/**
 * One puzzle: the conversation so far and the bot keyboard; once a reply is picked it goes into the
 * chat with its classification, and the coach's word is pinned above.
 */
export function PuzzleBoard(props: {
  puzzle: RizzPuzzle,
  onAnswer: (solved: boolean, picked: number) => void,
  /** Rush: no explanation, straight on. */
  quick?: boolean,
  /** What the composer offers once the puzzle is answered. */
  after?: JSX.Element
}) {
  const [picked, setPicked] = createSignal<number>();
  const turn = () => puzzleTurn(props.puzzle);
  const options = createMemo(() => optionOrder(turn(), props.puzzle.id.length * 7919 + props.puzzle.turn)
  .map((index) => ({text: turn().options[index].text, index})));

  const pick = (index: number) => {
    if(picked() !== undefined) return;
    setPicked(index);
    props.onAnswer(isPuzzleSolved(props.puzzle, index), index);
  };

  const verdict = () => picked() === undefined ? undefined : answerVerdict(turn(), picked());
  const classification = () => picked() === undefined ? undefined : classifyMove(turn(), turn().options[picked()]);

  const items = () => [
    ...props.puzzle.history.map((line) => ({text: line.text, out: line.mine})),
    ...(picked() !== undefined ? [{text: turn().options[picked()].text, out: true, classification: classification()}] : [])
  ];

  return (
    <>
      <Show when={verdict() && !props.quick}>
        <PinnedBar
          title={<><ClassDot classification={classification()} /> {verdict().right ? 'Correct!' : 'Not quite'}</>}
          muted={!verdict().right ? `Best: “${verdict().best.text}”` : undefined}
        >
          {turn().options[picked()].why}
        </PinnedBar>
      </Show>
      <Messages service={props.puzzle.setting} items={items()} />
      <div class={styles.composer}>
        <Show when={picked() === undefined || props.quick} fallback={props.after}>
          <InputBox>Find the best reply</InputBox>
          <ReplyKeyboard options={options()} onPick={pick} disabled={picked() !== undefined} />
        </Show>
      </div>
    </>
  );
}

function markSolved(id: string) {
  if(!profile.puzzlesSolved.includes(id)) {
    setProfile('puzzlesSolved', (list) => [...list, id]);
    addTrophies(TROPHIES.puzzle);
  }
}

export function PuzzlesScreen() {
  const [puzzle, setPuzzle] = createSignal(pickPuzzle(profile.ratings.puzzles, new Set(profile.puzzlesSolved)));
  const [delta, setDelta] = createSignal<number>();

  const onAnswer = (solved: boolean) => {
    const before = profile.ratings.puzzles;
    const after = updateRating(before, puzzle().rating, solved ? 1 : 0, profile.played.puzzles);
    pushRating('puzzles', after);
    setProfile('puzzleStreak', solved ? profile.puzzleStreak + 1 : 0);
    if(solved) markSolved(puzzle().id);
    setDelta(after - before);
  };

  const next = () => {
    setDelta(undefined);
    setPuzzle(pickPuzzle(profile.ratings.puzzles, new Set(profile.puzzlesSolved), puzzle().id));
  };

  return (
    <>
      <Topbar
        media={<Avatar icon="lamp" color="green" size={42} />}
        title="Puzzles"
        subtitle={<>
          rated {puzzle().rating} · yours {profile.ratings.puzzles}
          <Show when={delta() !== undefined}>
            {' '}<span classList={{[styles.up]: delta() > 0, [styles.down]: delta() < 0}}>{signed(delta())}</span>
          </Show>
          {profile.puzzleStreak > 1 ? ` · ${profile.puzzleStreak} in a row` : ''}
        </>}
      />
      <Show when={puzzle()} keyed>
        {(current) => (
          <PuzzleBoard
            puzzle={current}
            onAnswer={onAnswer}
            after={<ActionPlate label="Next puzzle" onClick={next} />}
          />
        )}
      </Show>
    </>
  );
}

export function DailyScreen() {
  const puzzle = dailyPuzzle();
  const today = dayKey();
  const [attempt, setAttempt] = createSignal(0);
  // solved in this visit: the board stays, with the coach's word on it
  const [solvedNow, setSolvedNow] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  const onAnswer = (solved: boolean) => {
    setFailed(!solved);
    if(!solved || profile.daily.last === today) return;
    setSolvedNow(true);
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    setProfile('daily', {last: today, streak: profile.daily.last === yesterday ? profile.daily.streak + 1 : 1});
    markSolved(puzzle.id);
  };

  return (
    <>
      <Topbar
        media={<Avatar icon="calendar" color="orange" size={42} />}
        title="Daily Puzzle"
        subtitle={`${new Date().toLocaleDateString(undefined, {month: 'long', day: 'numeric'})} · ${profile.daily.streak} day streak`}
      />
      <Show when={profile.daily.last !== today || solvedNow()} fallback={
        <Page>
          <div class={styles.profileHeader}>
            <div class={styles.heroEmoji}>✅</div>
            <div class={styles.profileName}>Solved today</div>
            <div class={styles.profileStatus}>{profile.daily.streak} day streak · a new puzzle arrives at midnight</div>
          </div>
        </Page>
      }>
        <Show when={attempt() + 1} keyed>
          <PuzzleBoard
            puzzle={puzzle}
            onAnswer={onAnswer}
            after={failed() ?
              <ActionPlate label="Try again" onClick={() => setAttempt((value) => value + 1)} /> :
              <ActionPlate label="Done" onClick={() => setSolvedNow(false)} />}
          />
        </Show>
      </Show>
    </>
  );
}

const RUSH_MS = 3 * 60 * 1000;
const RUSH_STRIKES = 3;

export function RushScreen() {
  const [phase, setPhase] = createSignal<'idle' | 'running' | 'over'>('idle');
  const [ladder, setLadder] = createSignal<RizzPuzzle[]>([]);
  const [index, setIndex] = createSignal(0);
  const [score, setScore] = createSignal(0);
  const [strikes, setStrikes] = createSignal(0);
  const [startedAt, setStartedAt] = createSignal(0);
  const [newBest, setNewBest] = createSignal(false);
  const now = createNow(100);
  const remaining = () => phase() === 'running' ? RUSH_MS - (now() - startedAt()) : RUSH_MS;
  let nextTimer: number;
  onCleanup(() => clearTimeout(nextTimer));

  const start = () => {
    setLadder(rushLadder());
    setIndex(0);
    setScore(0);
    setStrikes(0);
    setNewBest(false);
    setStartedAt(Date.now());
    setPhase('running');
  };

  const end = () => {
    if(phase() !== 'running') return;
    setPhase('over');
    clearTimeout(nextTimer);
    if(score() > profile.rushBest) {
      setProfile('rushBest', score());
      setNewBest(true);
    }
    if(score()) addTrophies(Math.ceil(score() / 2));
  };

  const timeCheck = setInterval(() => {
    if(phase() === 'running' && remaining() <= 0) end();
  }, 100);
  onCleanup(() => clearInterval(timeCheck));

  const onAnswer = (solved: boolean) => {
    if(solved) setScore((value) => value + 1);
    else setStrikes((value) => value + 1);
    nextTimer = window.setTimeout(() => {
      if(phase() !== 'running') return;
      if(strikes() >= RUSH_STRIKES || index() + 1 >= ladder().length) {
        end();
        return;
      }
      setIndex((value) => value + 1);
    }, solved ? 350 : 700);
  };

  return (
    <>
      <Topbar
        media={<Avatar icon="hourglass" color="red" size={42} />}
        title="Puzzle Rush"
        subtitle={phase() === 'idle' ?
          `best ${profile.rushBest}` :
          `score ${score()} · ${'✕'.repeat(strikes())}${'○'.repeat(RUSH_STRIKES - strikes())} · best ${profile.rushBest}`}
        right={<Show when={phase() === 'running'}>
          <div class={classNames(styles.clock, styles.running, remaining() < 20000 && styles.low)} role="timer">
            {formatClock(remaining())}
          </div>
        </Show>}
      />
      <Show when={phase() === 'running'} fallback={
        <Page>
          <div class={styles.profileHeader}>
            <Avatar icon="hourglass" color="red" size={100} />
            <div class={styles.profileName}>{phase() === 'over' ? `Score: ${score()}` : 'Puzzle Rush'}</div>
            <div class={styles.profileStatus}>
              {phase() === 'over' ?
                (newBest() ? 'New personal best!' : `Personal best: ${profile.rushBest}`) :
                'As many puzzles as you can in 3 minutes, harder as you go. Three wrong answers and you\'re out.'}
            </div>
          </div>
          <div class={styles.buttonWrap}>
            <Button primaryFilled class={styles.bigButton} onClick={start}>{phase() === 'over' ? 'Play again' : 'Start'}</Button>
          </div>
        </Page>
      }>
        <Show when={ladder()[index()]} keyed>
          {(puzzle) => <PuzzleBoard puzzle={puzzle} onAnswer={onAnswer} quick />}
        </Show>
      </Show>
    </>
  );
}

