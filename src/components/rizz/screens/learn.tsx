/*
 * Lessons: Coach Rizzo's channel — a lesson's posts — then a drill of puzzles from the opening book.
 */

import {createSignal, For, Show} from 'solid-js';
import LESSONS from '@components/rizz/content/lessons';
import {getPuzzle} from '@components/rizz/engine';
import {navigate} from '@components/rizz/router';
import {profile, setProfile} from '@components/rizz/store';
import {PuzzleBoard} from '@components/rizz/screens/puzzles';
import {ActionPlate, Avatar, Block, ListRow, Messages, Page, styles, Topbar} from '@components/rizz/ui';
import {IconTsx} from '@components/iconTsx';

const LESSON_ICONS: Icon[] = ['message', 'reply', 'flag', 'lock'];

export function LessonsScreen() {
  return (
    <>
      <Topbar media={<Avatar icon="channel" color="violet" size={42} />} title="Coach Rizzo" subtitle={`${LESSONS.length} lessons · ${profile.lessonsDone.length} done`} />
      <Page>
        <Block name="Lessons" caption="Each lesson is a few posts and a drill of four puzzles.">
          <For each={LESSONS}>{(lesson, index) => (
            <ListRow
              small
              media={<Avatar icon={LESSON_ICONS[index()]} color="violet" size={42} />}
              title={lesson.title}
              subtitle={lesson.subtitle}
              badge={profile.lessonsDone.includes(lesson.id) && <IconTsx icon="check" class={styles.check} />}
              onClick={() => navigate({name: 'lesson', lessonId: lesson.id})}
            />
          )}</For>
        </Block>
      </Page>
    </>
  );
}

export function LessonScreen(props: {lessonId: string}) {
  const lesson = LESSONS.find((lesson) => lesson.id === props.lessonId);
  // -1: reading the posts; then the drill's puzzles one by one; length: done
  const [step, setStep] = createSignal(-1);
  const [correct, setCorrect] = createSignal(0);

  const puzzle = () => step() >= 0 && step() < lesson.drill.length ? getPuzzle(lesson.drill[step()]) : undefined;
  const last = () => step() + 1 >= lesson.drill.length;

  const next = () => {
    const nextStep = step() + 1;
    setStep(nextStep);
    if(nextStep >= lesson.drill.length && !profile.lessonsDone.includes(lesson.id)) {
      setProfile('lessonsDone', (list) => [...list, lesson.id]);
    }
  };

  return (
    <>
      <Topbar
        media={<Avatar icon="channel" color="violet" size={42} />}
        title={lesson.title}
        subtitle={step() < 0 ? 'Coach Rizzo · channel' : step() < lesson.drill.length ? `drill ${step() + 1} of ${lesson.drill.length}` : 'complete'}
        onBack={() => navigate({name: 'lessons'})}
      />
      <Show when={step() < 0}>
        <Messages service={lesson.subtitle} items={lesson.posts.map((text) => ({text}))} />
        <div class={styles.composer}>
          <ActionPlate label="Start the drill" onClick={next} />
        </div>
      </Show>
      <Show when={puzzle()} keyed>
        {(current) => (
          <PuzzleBoard
            puzzle={current}
            onAnswer={(solved) => solved && setCorrect((value) => value + 1)}
            after={<ActionPlate label={last() ? 'Finish' : 'Next'} onClick={next} />}
          />
        )}
      </Show>
      <Show when={step() >= lesson.drill.length}>
        <Page>
          <div class={styles.profileHeader}>
            <Avatar icon="check" color="green" size={100} />
            <div class={styles.profileName}>Lesson complete</div>
            <div class={styles.profileStatus}>{correct()} of {lesson.drill.length} drills solved on the first try</div>
          </div>
          <Block>
            <ListRow small media={<Avatar icon="channel" color="violet" size={42} />} title="All lessons" subtitle="Back to Coach Rizzo" onClick={() => navigate({name: 'lessons'})} />
            <ListRow small media={<Avatar icon="bots" color="green" size={42} />} title="Practice against a bot" subtitle="Put it to use" onClick={() => navigate({name: 'bots'})} />
          </Block>
        </Page>
      </Show>
    </>
  );
}
