/*
 * Leaderboard and Leagues, as Telegram's member lists — the players are simulated (`world.ts`),
 * the player is real.
 */

import {createMemo, createSignal, For, Show} from 'solid-js';
import {profile, RizzProfile} from '@components/rizz/store';
import {DEMOTE, DIVISIONS, LEAGUE_SIZE, leaderboard, leagueTable, PROMOTE, settleLeague, TROPHIES} from '@components/rizz/world';
import {Avatar, Block, ListRow, Page, styles, Topbar} from '@components/rizz/ui';
import {ChipTab, ChipTabs} from '@components/chipTabs';

const KINDS: {id: keyof RizzProfile['ratings'], label: string}[] = [
  {id: 'blitz', label: 'Blitz'},
  {id: 'bullet', label: 'Bullet'},
  {id: 'rapid', label: 'Rapid'},
  {id: 'puzzles', label: 'Puzzles'}
];

export function LeaderboardScreen() {
  const [kind, setKind] = createSignal<keyof RizzProfile['ratings']>('blitz');
  const board = createMemo(() => leaderboard(kind()));

  return (
    <>
      <Topbar media={<Avatar icon="poll" color="cyan" size={42} />} title="Leaderboard" subtitle={`you are #${board().rank.toLocaleString()} · ${board().mine}`} />
      <Page>
        <div class={styles.chips}>
          <ChipTabs value={kind()} view="surface" onChange={(value) => void setKind(value as keyof RizzProfile['ratings'])}>
            <For each={KINDS}>{(item) => <ChipTab value={item.id}>{item.label}</ChipTab>}</For>
          </ChipTabs>
        </div>
        <Block>
          <ListRow
            small
            active
            media={<Avatar name={profile.name} color={profile.color} size={42} />}
            title={profile.name}
            subtitle={`#${board().rank.toLocaleString()} in the world`}
            meta={String(board().mine)}
          />
        </Block>
        <Block name="Top 50">
          <For each={board().entries}>{(entry, index) => (
            <ListRow
              small
              media={<Avatar name={entry.name} color={entry.color} size={42} />}
              title={<>{entry.title && <span class={styles.titleChip}>{entry.title}</span>}{entry.name} {entry.country}</>}
              subtitle={`#${index() + 1}`}
              meta={String(entry.rating)}
            />
          )}</For>
        </Block>
      </Page>
    </>
  );
}

export function LeaguesScreen() {
  settleLeague();
  const division = () => DIVISIONS[profile.league.division];
  const table = createMemo(() => leagueTable());
  const rank = () => table().findIndex((entry) => entry.me) + 1;
  const daysLeft = () => 7 - ((new Date().getDay() + 6) % 7);

  return (
    <>
      <Topbar
        media={<Avatar icon="crown" color="stars" size={42} />}
        title={`${division().name} League`}
        subtitle={`${daysLeft()} day${daysLeft() === 1 ? '' : 's'} left · #${rank()}`}
      />
      <Page>
        <div class={styles.profileHeader}>
          <div class={styles.heroEmoji}>{division().emoji}</div>
          <div class={styles.profileName}>{division().name} League</div>
          <div class={styles.profileStatus}>
            <Show when={profile.league.lastResult && profile.league.lastResult !== 'stayed'} fallback={`${profile.league.trophies} trophies this week`}>
              You were {profile.league.lastResult} last week · {profile.league.trophies} trophies
            </Show>
          </div>
        </div>
        <Block
          name="This week"
          caption={`Top ${PROMOTE} move up, bottom ${DEMOTE} move down on Monday. Trophies: rated win ${TROPHIES.win}, draw ${TROPHIES.draw}, loss ${TROPHIES.loss}, puzzle ${TROPHIES.puzzle}, and half your Puzzle Rush score.`}
        >
          <For each={table()}>{(entry, index) => (
            <ListRow
              small
              active={entry.me}
              class={index() < PROMOTE ? styles.zonePromote : index() >= LEAGUE_SIZE - DEMOTE ? styles.zoneDemote : undefined}
              media={<Avatar name={entry.name} color={entry.color} size={42} />}
              title={entry.name}
              subtitle={index() < PROMOTE ? 'promotion zone' : index() >= LEAGUE_SIZE - DEMOTE ? 'demotion zone' : `#${index() + 1}`}
              meta={`${entry.trophies} 🏆`}
            />
          )}</For>
        </Block>
      </Page>
    </>
  );
}
