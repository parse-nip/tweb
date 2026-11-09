import {createSignal, For, onCleanup, Show, batch, createEffect, on} from 'solid-js';
import PopupElement, {createPopup} from '@components/popups/indexTsx';
import CheckboxFieldTsx from '@components/checkboxFieldTsx';
import Row from '@components/rowTsx';
import Section from '@components/section';
import RadioFieldTsx from '@components/radioFieldTsx';
import Button from '@components/buttonTsx';
import {ButtonIconTsx} from '@components/buttonIconTsx';
import {InputFieldTsx} from '@components/inputFieldTsx';
import type InputField from '@components/inputField';
import {IconTsx} from '@components/iconTsx';
import {refreshRizzBadges} from '@components/rizz/bubbleRating';
import badgeStyles from '@components/rizz/ratingBadge.module.scss';
import classNames from '@helpers/string/classNames';
import {clearRatingCache} from '@lib/rizz/ratingCache';
import {cancelQueuedVerdicts} from '@lib/rizz/ratingService';
import {RIZZ_DIFFICULTIES, RIZZ_PERSONAS, RizzDifficulty, getRizzPersona} from '@lib/rizz/personas';
import {RIZZ_RATINGS, getRizzRatingDef} from '@lib/rizz/ratings';
import {
  SIM_MAX_USER_MESSAGES, SimMessage, SimReport, SimState, applyInterest, applyVerdict, createSimulation, getPersonaReply, getSimHints, getSimReport, gradeSimMessage
} from '@lib/rizz/simulator';
import {
  DEFAULT_CLASSIFIER_MODEL, DEFAULT_FAST_MODEL, getRizzSettings, hasRizzKey, setRizzSettings
} from '@lib/rizz/settings';
import createRatingGlyph from '@components/rizz/ratingGlyph';
import styles from '@components/rizz/rizzCoachPopup.module.scss';

type Tab = 'simulator' | 'settings';


const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function SettingsTab() {
  const [saved, setSaved] = createSignal(false);
  let keyField: InputField, classifierField: InputField, fastField: InputField;

  const save = () => {
    setRizzSettings({
      apiKey: keyField.value.trim(),
      classifierModel: classifierField.value.trim(),
      fastModel: fastField.value.trim()
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <>
      <Section
        caption={hasRizzKey() ?
          'Messages you send and receive in the open chat are sent to OpenRouter to be graded and to write suggestions.' :
          'No OpenRouter key yet: set OPENROUTER_API_KEY in .env.local and restart, or paste one below (kept in this browser only).'}
      >
        <Row>
          <Row.CheckboxFieldToggle>
            <CheckboxFieldTsx
              toggle
              checked={getRizzSettings().ratings}
              onChange={(checked) => {
                setRizzSettings({ratings: checked});
                if(!checked) cancelQueuedVerdicts();
                refreshRizzBadges();
              }}
            />
          </Row.CheckboxFieldToggle>
          <Row.Title>Chess ratings</Row.Title>
          <Row.Subtitle>A label on every message: Brilliant, Great, Mistake, Blunder…</Row.Subtitle>
        </Row>
        <Row>
          <Row.CheckboxFieldToggle>
            <CheckboxFieldTsx
              toggle
              checked={getRizzSettings().ghost}
              onChange={(checked) => setRizzSettings({ghost: checked})}
            />
          </Row.CheckboxFieldToggle>
          <Row.Title>Ghost text</Row.Title>
          <Row.Subtitle>Light grey text after what you type. Press Tab to accept it.</Row.Subtitle>
        </Row>
      </Section>

      <Section name={<span>OpenRouter</span>} noDelimiter>
        <InputFieldTsx instanceRef={(field) => keyField = field} labelText="OpenRouter API key" plainText
          value={getRizzSettings().apiKey} />
        <InputFieldTsx instanceRef={(field) => classifierField = field} labelText="Classifier model" plainText
          value={getRizzSettings().classifierModel} />
        <InputFieldTsx instanceRef={(field) => fastField = field} labelText="Fast model (suggestions, simulator)" plainText
          value={getRizzSettings().fastModel} />
        <Button primaryFilled large onClick={save}>{saved() ? 'Saved' : 'Save'}</Button>
        <Button primaryTransparent large onClick={() => {clearRatingCache(); refreshRizzBadges();}}>Forget cached ratings</Button>
      </Section>
    </>
  );
}

function SimulatorTab() {
  const [personaId, setPersonaId] = createSignal(RIZZ_PERSONAS[0].id);
  const [difficulty, setDifficulty] = createSignal<RizzDifficulty>('medium');
  const [sim, setSim] = createSignal<SimState>();
  const [draft, setDraft] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [typing, setTyping] = createSignal(false);
  const [hints, setHints] = createSignal<string[]>([]);
  const [hintsBusy, setHintsBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [report, setReport] = createSignal<SimReport>();
  const [reportBusy, setReportBusy] = createSignal(false);

  const abort = new AbortController();
  onCleanup(() => abort.abort());

  let nextId = 1;
  let chatEl: HTMLDivElement;
  const grading = new Set<Promise<any>>();

  const userCount = () => sim()?.messages.filter((message) => message.from === 'me').length ?? 0;
  const finished = () => !!sim()?.ending || userCount() >= SIM_MAX_USER_MESSAGES;

  createEffect(() => {
    sim()?.messages.length;
    typing();
    queueMicrotask(() => chatEl?.scrollTo({top: chatEl.scrollHeight}));
  });

  const patch = (id: number, changes: Partial<SimMessage>) => {
    setSim((state) => state && {...state, messages: state.messages.map((message) => message.id === id ? {...message, ...changes} : message)});
  };

  // the game is over: the coach's review opens by itself
  createEffect(on(() => sim()?.ending, (ending) => {
    if(ending && !report()) setTimeout(() => void review(), 1400);
  }, {defer: true}));

  const start = () => {
    batch(() => {
      setSim(createSimulation(personaId(), difficulty()));
      setDraft('');
      setHints([]);
      setError('');
      setReport(undefined);
    });
  };

  const send = async(text = draft()) => {
    text = text.trim();
    const state = sim();
    if(!text || busy() || finished() || !state) return;

    const message: SimMessage = {id: nextId++, from: 'me', text, grading: true};
    const next: SimState = {...state, messages: [...state.messages, message]};
    batch(() => {
      setSim(next);
      setDraft('');
      setHints([]);
      setError('');
      setBusy(true);
    });

    const index = next.messages.length - 1;
    const gradePromise = gradeSimMessage(next, index, abort.signal)
    .then((verdict) => {
      if(!verdict) return patch(message.id, {grading: false});
      // the label moves the Elo, and a Checkmate or a Resign ends the game
      setSim((current) => {
        if(!current) return current;
        const applied = applyVerdict(current, verdict);
        return {
          ...applied.state,
          messages: applied.state.messages.map((item) => item.id === message.id ? {...item, verdict, delta: applied.delta, grading: false} : item)
        };
      });
    })
    .catch(() => patch(message.id, {grading: false}));
    grading.add(gradePromise);
    void gradePromise.finally(() => grading.delete(gradePromise));

    try {
      setTyping(true);
      const {replies, interest} = await getPersonaReply(next, abort.signal);
      let messages = next.messages;
      for(const reply of replies) {
        await sleep(450 + Math.min(1400, reply.length * 25));
        if(abort.signal.aborted) return;
        messages = [...messages, {id: nextId++, from: 'them', text: reply}];
        setSim((current) => current && {...current, messages: [...current.messages, messages[messages.length - 1]]});
      }

      await Promise.allSettled([...grading]);
      setSim((current) => {
        if(!current) return current;
        const next = applyInterest(current, interest);
        if(next.ending !== 'checkmate' || current.ending) return next;
        // won over by interest: the message that did it is the mating move
        const lastMine = [...next.messages].reverse().find((item) => item.from === 'me');
        return {
          ...next,
          messages: next.messages.map((item) => item === lastMine ? {...item, verdict: {rating: 'checkmate' as const, elo: 2800, reason: 'Checkmate'}, grading: false} : item)
        };
      });
    } catch(err) {
      if(!abort.signal.aborted) setError((err as Error).message || 'The simulator could not answer.');
    } finally {
      setTyping(false);
      setBusy(false);
    }
  };

  const askHints = async() => {
    const state = sim();
    if(!state || hintsBusy()) return;
    setHintsBusy(true);
    setError('');
    try {
      setHints(await getSimHints(state, abort.signal));
    } catch(err) {
      if(!abort.signal.aborted) setError((err as Error).message || 'The coach could not answer.');
    } finally {
      setHintsBusy(false);
    }
  };

  const review = async() => {
    if(!sim() || reportBusy()) return;
    setReportBusy(true);
    try {
      await Promise.allSettled([...grading]);
      setReport(await getSimReport(sim(), abort.signal));
    } catch(err) {
      if(!abort.signal.aborted) setError((err as Error).message || 'The coach could not answer.');
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <Show
      when={sim()}
      fallback={
        <>
          <Section name={<span>Who are you texting?</span>} caption="Pick who you're texting. They won't make it easy: every message you send gets a chess rating." noDelimiter>
            <For each={RIZZ_PERSONAS}>{(persona) => (
              <Row clickable={() => setPersonaId(persona.id)}>
                <Row.RadioField>
                  <RadioFieldTsx name="rizz-persona" value={persona.id} checked={personaId() === persona.id}
                    onChange={(checked) => checked && setPersonaId(persona.id)} />
                </Row.RadioField>
                <Row.Title>{persona.emoji} {persona.name}</Row.Title>
                <Row.Subtitle>{persona.tagline}</Row.Subtitle>
              </Row>
            )}</For>
          </Section>
          <Section name={<span>Difficulty</span>} noDelimiter>
            <For each={RIZZ_DIFFICULTIES}>{(item) => (
              <Row clickable={() => setDifficulty(item.id)}>
                <Row.RadioField>
                  <RadioFieldTsx name="rizz-difficulty" value={item.id} checked={difficulty() === item.id}
                    onChange={(checked) => checked && setDifficulty(item.id)} />
                </Row.RadioField>
                <Row.Title>{item.title}</Row.Title>
                <Row.Subtitle>{item.hint}</Row.Subtitle>
              </Row>
            )}</For>
          </Section>
          <Show when={!hasRizzKey()}>
            <p class={styles.hint}>Add your OpenRouter key in settings first (the gear above).</p>
          </Show>
          <Button primaryFilled large disabled={!hasRizzKey()} onClick={start}>Start texting</Button>
        </>
      }
    >
      {(state) => {
        const persona = () => getRizzPersona(state().personaId);
        return (
          <>
            <div class={styles.meter}>
              <div class={styles.meterText}>
                <span>{persona().emoji} {persona().name}{typing() ? ' · typing…' : ''}</span>
                <span>♟ {state().elo} Elo · Interest {state().interest}%</span>
              </div>
              <div class={styles.meterBar}><div class={styles.meterFill} style={{width: state().interest + '%'}} /></div>
            </div>

            <div class={styles.chat} ref={chatEl}>
              <Show when={!state().messages.length}>
                <p class={styles.hint}>It's your move. Send the first message, or ask the coach for ideas.</p>
              </Show>
              <For each={state().messages}>{(message) => {
                const def = () => message.verdict && getRizzRatingDef(message.verdict.rating);
                return (
                  <div class={classNames(styles.message, message.from === 'me' ? styles.isMe : styles.isThem)}>
                    {message.text}
                    <Show when={message.from === 'me' && (message.grading || def())}>
                      <div
                        class={classNames(badgeStyles.badge, badgeStyles.isOut, message.grading && badgeStyles.isPending)}
                        style={{'--rizz-color': def()?.color}}
                        title={def() ? `${def().title} · ~${message.verdict.elo} Elo${message.verdict.reason ? ' — ' + message.verdict.reason : ''}` : undefined}
                      >
                        {message.grading ? <div class={badgeStyles.pending} /> : createRatingGlyph(def())}
                      </div>
                    </Show>
                  </div>
                );
              }}</For>
              <Show when={typing()}><div class={styles.typing}>typing…</div></Show>
            </div>

            <Show when={error()}><div class={styles.error}>{error()}</div></Show>

            <Show when={state().ending}>
              {(ending) => (
                <div class={styles.banner}>
                  <span class={styles.bannerIcon}>
                    {createRatingGlyph(getRizzRatingDef(ending() === 'resign' ? 'resign' : 'checkmate'), ending() === 'left-on-read')}
                  </span>
                  {ending() === 'checkmate' ? `Checkmate. ${persona().emoji} You won them over.` :
                    ending() === 'resign' ? 'You resigned. The chat is over.' :
                      `Checkmate. ${persona().emoji} They left you on read.`}
                </div>
              )}
            </Show>

            <Show when={hints().length}>
              <div class={styles.hints}>
                <For each={hints()}>{(hint) => <button class={styles.hintOption} onClick={() => setDraft(hint)}>{hint}</button>}</For>
              </div>
            </Show>

            <Show when={!finished()}>
              <form class={styles.composer} onSubmit={(event) => {event.preventDefault(); void send();}}>
                <input
                  class={styles.composerInput}
                  value={draft()}
                  disabled={busy()}
                  maxLength={500}
                  placeholder="Write a message…"
                  onInput={(event) => setDraft(event.currentTarget.value)}
                />
                <ButtonIconTsx class={classNames(styles.send, (busy() || !draft().trim()) && 'is-disabled')} icon="send2" type="submit" disabled={busy() || !draft().trim()} aria-label="Send" />
              </form>
            </Show>

            <div class={styles.buttons}>
              <Show when={!finished()}>
                <Button primaryTransparent disabled={hintsBusy() || busy()} onClick={askHints}>
                  {hintsBusy() ? 'Thinking…' : '💡 Hint'}
                </Button>
              </Show>
              <Button primaryTransparent disabled={reportBusy() || !userCount()} onClick={review}>
                {reportBusy() ? 'Reviewing…' : 'End & review'}
              </Button>
              <Button primaryTransparent onClick={() => setSim(undefined)}>New person</Button>
            </div>

            <Show when={report()}>
              {(result) => (
                <div class={styles.report}>
                  <div class={styles.stats}>
                    <div class={styles.stat}><span class={styles.statValue}>{result().elo}</span><span class={styles.statLabel}>Your Elo</span></div>
                    <div class={styles.stat}><span class={styles.statValue}>{result().accuracy}%</span><span class={styles.statLabel}>Accuracy</span></div>
                    <div class={styles.stat}><span class={styles.statValue}>{state().interest}%</span><span class={styles.statLabel}>Interest</span></div>
                  </div>
                  <div class={styles.counts}>
                    <For each={RIZZ_RATINGS.filter((def) => result().counts[def.id])}>{(def) => (
                      <span class={styles.count}>
                        <span class={styles.countDot}>{createRatingGlyph(def)}</span>
                        {def.title} × {result().counts[def.id]}
                      </span>
                    )}</For>
                  </div>
                  <p class={styles.feedback}>{result().feedback}</p>
                </div>
              )}
            </Show>
          </>
        );
      }}
    </Show>
  );
}

export default function showRizzCoachPopup(options: {tab?: Tab} = {}) {
  createPopup(() => {
    const [tab, setTab] = createSignal<Tab>(options.tab ?? (hasRizzKey() ? 'simulator' : 'settings'));
    return (
      <PopupElement class={styles.popup} closable>
        <PopupElement.Header>
          <PopupElement.Title title="RizzCoach" />
          <ButtonIconTsx
            icon={tab() === 'settings' ? 'message_filled' : 'settings'}
            aria-label={tab() === 'settings' ? 'Simulator' : 'Settings'}
            onClick={() => setTab(tab() === 'settings' ? 'simulator' : 'settings')}
          />
        </PopupElement.Header>
        <PopupElement.Scrollable>
          <PopupElement.Body class={styles.body}>
            <Show when={tab() === 'simulator'} fallback={<SettingsTab />}>
              <SimulatorTab />
            </Show>
          </PopupElement.Body>
        </PopupElement.Scrollable>
      </PopupElement>
    );
  });
}
