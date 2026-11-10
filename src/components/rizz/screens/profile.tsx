/*
 * Profile (ratings, record, achievements), the game archive, and settings — Telegram's profile and
 * settings screens: a big avatar, then sections of rows.
 */

import {createMemo, createSignal, For, Show} from 'solid-js';
import {AVATAR_COLORS} from '@components/rizz/content/bots';
import {navigate} from '@components/rizz/router';
import {profile, resetProfile, RizzRatingKind, setProfile} from '@components/rizz/store';
import {ACHIEVEMENTS} from '@components/rizz/world';
import {Avatar, Block, Graph, Page, SettingsRow, styles, TextField, Topbar} from '@components/rizz/ui';
import GameRow from '@components/rizz/gameRow';
import {confirmAction} from '@components/rizz/popups';
import {RIZZ_SPICE} from '@lib/rizz/spice';
import RangeStepsSelector from '@components/rangeStepsSelectorTsx';
import Row from '@components/rowTsx';
import CheckboxFieldTsx from '@components/checkboxFieldTsx';
import {IconTsx} from '@components/iconTsx';
import {appSettings} from '@stores/appSettings';
import {setSandboxTheme} from '@components/popupSandbox/environment';
import classNames from '@helpers/string/classNames';

const RATING_KINDS: {id: RizzRatingKind, label: string, icon: Icon}[] = [
  {id: 'rizz', label: 'Rating', icon: 'bots'},
  {id: 'puzzles', label: 'Puzzles', icon: 'lamp'}
];

export function ProfileScreen() {
  const [kind, setKind] = createSignal<RizzRatingKind>('rizz');
  const record = createMemo(() => {
    const games = profile.games;
    const count = (result: string) => games.filter((game) => game.result === result).length;
    const accuracy = games.length ? games.reduce((sum, game) => sum + game.accuracy, 0) / games.length : 0;
    return {win: count('win'), draw: count('draw'), loss: count('loss'), accuracy};
  });

  return (
    <>
      <Topbar media={<Avatar name={profile.name} color={profile.color} size={42} />} title={profile.name} subtitle={`${profile.visit.streak} day streak`} />
      <Page>
        <div class={styles.profileHeader}>
          <Avatar name={profile.name} color={profile.color} size={120} />
          <div class={styles.profileName}>{profile.name}</div>
          <div class={styles.profileStatus}>rating {profile.ratings.rizz} · {profile.visit.streak} day streak</div>
        </div>
        <Block>
          <div class={styles.statsGrid}>
            <div><div class={classNames(styles.statValue, styles.up)}>{record().win}</div><div class={styles.statLabel}>Dates</div></div>
            <div><div class={styles.statValue}>{record().draw}</div><div class={styles.statLabel}>Friendzoned</div></div>
            <div><div class={classNames(styles.statValue, styles.down)}>{record().loss}</div><div class={styles.statLabel}>Ghosted</div></div>
            <div><div class={styles.statValue}>{record().accuracy.toFixed(1)}</div><div class={styles.statLabel}>Accuracy</div></div>
          </div>
        </Block>
        <Block name="Ratings">
          <For each={RATING_KINDS}>{(item) => (
            <SettingsRow
              icon={item.icon}
              title={String(profile.ratings[item.id])}
              subtitle={`${item.label} · ${profile.played[item.id]} played`}
              right={kind() === item.id && <IconTsx icon="check" class={styles.check} />}
              onClick={() => setKind(item.id)}
            />
          )}</For>
          <div class={styles.graphWrap}>
            <Show when={profile.ratingHistory[kind()].length > 1} fallback={
              <div class={styles.caption}>Play some {kind() === 'puzzles' ? 'puzzles' : 'games'} to see your graph.</div>
            }>
              <Graph values={profile.ratingHistory[kind()]} />
            </Show>
          </div>
        </Block>
        <Block name={`Achievements · ${ACHIEVEMENTS.filter((a) => a.done(profile)).length} of ${ACHIEVEMENTS.length}`}>
          <div class={styles.achievements}>
            <For each={ACHIEVEMENTS}>{(achievement) => (
              <div class={classNames(styles.achievement, achievement.done(profile) && styles.done)}>
                <div class={styles.achievementEmoji} aria-hidden="true">{achievement.emoji}</div>
                <div class={styles.achievementTitle}>{achievement.title}</div>
                <div class={styles.achievementDescription}>{achievement.description}</div>
              </div>
            )}</For>
          </div>
        </Block>
        <Block>
          <SettingsRow icon="archive" title="Game Archive" right={<span class={styles.rowMeta}>{profile.games.length}</span>} onClick={() => navigate({name: 'archive'})} />
          <SettingsRow icon="settings" title="Settings" onClick={() => navigate({name: 'settings'})} />
        </Block>
      </Page>
    </>
  );
}

export function ArchiveScreen() {
  return (
    <>
      <Topbar media={<Avatar icon="archive" color="archive" size={42} />} title="Game Archive" subtitle={`${profile.games.length} games`} />
      <Show when={profile.games.length} fallback={<div class={styles.emptyPill}>No games yet</div>}>
        <Page>
          <Block caption="Open a game for its review.">
            <For each={profile.games}>{(game) => <GameRow game={game} />}</For>
          </Block>
        </Page>
      </Show>
    </>
  );
}

/** A spice level (`@lib/rizz/spice`): Telegram's stepped slider, from Wholesome to Spicy. */
function SpiceSlider(props: {label: string, value: number, onChange: (value: number) => void}) {
  return (
    <div class={styles.range}>
      <div class={styles.rangeHead}><span>{props.label}</span></div>
      <RangeStepsSelector
        steps={RIZZ_SPICE.map((item) => [item.title, item.level])}
        indexByValue={props.value}
        onValue={(value: number) => props.onChange(value)}
      />
    </div>
  );
}

function ToggleRow(props: {icon: Icon, title: string, subtitle?: string, checked: boolean, onChange: (value: boolean) => void}) {
  return (
    <Row>
      <Row.Icon icon={props.icon} />
      <Row.Title>{props.title}</Row.Title>
      {props.subtitle && <Row.Subtitle>{props.subtitle}</Row.Subtitle>}
      <Row.CheckboxFieldToggle>
        <CheckboxFieldTsx toggle checked={props.checked} onChange={props.onChange} />
      </Row.CheckboxFieldToggle>
    </Row>
  );
}

export function SettingsScreen() {
  const isNight = () => appSettings.theme === 'night' ||
    (appSettings.theme === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const reset = async() => {
    const ok = await confirmAction({
      title: 'Reset progress?',
      description: 'Ratings, games, puzzles, bots and streaks are deleted from this browser.',
      button: 'Reset',
      danger: true
    });
    if(ok) {
      resetProfile();
      navigate({name: 'home'});
    }
  };

  return (
    <>
      <Topbar media={<Avatar icon="settings" color="blue" size={42} />} title="Settings" />
      <Page>
        <div class={styles.profileHeader}>
          <Avatar name={profile.name} color={profile.color} size={120} />
          <div class={styles.profileName}>{profile.name}</div>
        </div>
        <Block name="Your name">
          <TextField label="Name" value={profile.name} maxLength={24} onInput={(value) => setProfile('name', value.trim() || 'You')} />
          <div class={styles.colors} role="radiogroup" aria-label="Avatar colour">
            <For each={AVATAR_COLORS}>{(color) => (
              <button
                type="button"
                role="radio"
                aria-checked={profile.color === color}
                aria-label={color}
                class={classNames('avatar-gradient', styles.colorSwatch, profile.color === color && styles.active)}
                data-color={color}
                onClick={() => setProfile('color', color)}
              />
            )}</For>
          </div>
        </Block>
        <Block name="Game">
          <ToggleRow
            icon="like"
            title="Interest line"
            subtitle="How into you they are, under the chat's header"
            checked={profile.settings.vibeBar}
            onChange={(value) => setProfile('settings', 'vibeBar', value)}
          />
          <ToggleRow
            icon="lamp"
            title="Ghost text"
            subtitle="The coach suggests how your message could go on — Tab takes it"
            checked={profile.settings.ghost}
            onChange={(value) => setProfile('settings', 'ghost', value)}
          />
          <Show when={profile.settings.ghost}>
            <SpiceSlider label="Ghost text spice" value={profile.settings.ghostSpice} onChange={(value) => setProfile('settings', 'ghostSpice', value)} />
          </Show>
          <SpiceSlider label="Bots' spice" value={profile.settings.botSpice} onChange={(value) => setProfile('settings', 'botSpice', value)} />
          <ToggleRow icon="darkmode" title="Night mode" checked={isNight()} onChange={(value) => setSandboxTheme(value ? 'night' : 'day')} />
        </Block>
        <Block caption="Rizzmate runs entirely in your browser. Nothing you play is sent anywhere.">
          <SettingsRow icon="delete" title="Reset progress" danger onClick={reset} />
        </Block>
      </Page>
    </>
  );
}
