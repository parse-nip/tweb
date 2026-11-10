/*
 * Puzzles: a conversation cut at a decision; the player writes the next message and the Coach's classifier grades
 * it — Excellent and up solves it. Rated puzzles move the puzzle rating; the Daily Puzzle keeps a streak; Puzzle
 * Rush is three minutes and three strikes.
 */

import {createSignal, JSX, onCleanup, Show} from 'solid-js';
import {
  bestOption, dailyPuzzle, dayKey, isSolvingVerdict, pickPuzzle, puzzleTurn, RizzPuzzle, rushLadder, updateRating
} from '@components/rizz/engine';
import {classifyLines} from '@lib/rizz/classifier';
import {getRizzRatingDef, RizzVerdict} from '@lib/rizz/ratings';
import {profile, pushRating, setProfile} from '@components/rizz/store';
import {addTrophies, TROPHIES} from '@components/rizz/world';
import {
  ActionPlate, Avatar, BubbleData, createNow, formatClock, Glyph, Messages, Page, PinnedBar, signed, styles, Topbar
} from '@components/rizz/ui';
import Composer from '@components/rizz/composer';
import Button from '@components/buttonTsx';
import {toast} from '@components/toast';
import classNames from '@helpers/string/classNames';

const ANSWER_MID = 1e9;

/**
 * One puzzle: the conversation so far and the message box. The player's message goes into the chat with a
 * spinner for a badge, then the Coach's label; the verdict is pinned above with one strong reply to compare.
 */
export function PuzzleBoard(props: {
  puzzle: RizzPuzzle,
  onAnswer: (solved: boolean, verdict: RizzVerdict) => void,
  /** Rush: no explanation, straight on. */
  quick?: boolean,
  /** What the composer offers once the puzzle is answered. */
  after?: JSX.Element
}) {
  const [answer, setAnswer] = createSignal<string>();
  const [verdict, setVerdict] = createSignal<RizzVerdict>();
  const [grading, setGrading] = createSignal(false);

  const lines = () => props.puzzle.history.map((line, index) => ({mid: index + 1, out: line.mine, text: line.text}));

  const submit = async(text: string) => {
    setAnswer(text);
    setGrading(true);
    try {
      const verdicts = await classifyLines([...lines(), {mid: ANSWER_MID, out: true, text}], [ANSWER_MID]);
      const result = verdicts.get(ANSWER_MID);
      if(!result) throw new Error('no verdict');
      setVerdict(result);
      props.onAnswer(isSolvingVerdict(result), result);
    } catch(err) {
      setAnswer(undefined);
      toast('The coach could not grade that. Send it again.');
    } finally {
      setGrading(false);
    }
  };

  const items = (): BubbleData[] => [
    ...props.puzzle.history.map((line) => ({text: line.text, out: line.mine})),
    ...(answer() ? [{text: answer(), out: true, verdict: verdict() || (grading() ? 'pending' as const : undefined)}] : [])
  ];

  return (
    <>
      <Show when={verdict() && !props.quick}>
        <PinnedBar
          title={<><Glyph verdict={verdict()} /> {isSolvingVerdict(verdict()) ? 'Solved' : 'Not quite'} · {getRizzRatingDef(verdict().rating).title} · ~{verdict().elo} Elo</>}
          muted={`A strong reply: “${bestOption(puzzleTurn(props.puzzle)).text}”`}
        >
          {verdict().reason || getRizzRatingDef(verdict().rating).hint}
        </PinnedBar>
      </Show>
      <Messages service={`${props.puzzle.setting}\nWrite the best next message.`} items={items()} />
      <div class={styles.composer}>
        <Show when={!verdict() || props.quick} fallback={props.after}>
          <Composer
            placeholder={grading() ? 'The coach is grading…' : 'Your move…'}
            disabled={grading() || !!verdict()}
            lines={lines}
            ghost={false}
            onSend={submit}
          />
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
        {(current) => <PuzzleBoard puzzle={current} onAnswer={onAnswer} after={<ActionPlate label="Next puzzle" onClick={next} />} />}
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
    }, 900);
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
                'Write the best next message, as many times as you can in 3 minutes. Excellent or better scores; three misses and you\'re out.'}
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
