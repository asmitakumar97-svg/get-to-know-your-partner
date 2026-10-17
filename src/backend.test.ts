import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSectionDeck, scenarios, sections } from './scenarios';
import { partyDecks, partyGameIds } from './catalog';
import { partyRecap } from './party';
import type { ChoiceGameState, SessionState } from './game';
import { buildPlaylist, nightReflection, nightReportText } from './night';
import { chooseOfflineQuestions } from './freshQuestions';

const db = new PGlite();
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const stranger = '33333333-3333-4333-8333-333333333333';
let roomId: string;
let code: string;
async function asUser(id: string) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function state() {
  const result = await db.query<{ state: { phase: string; round: number; answers: Record<string, unknown>; ready: string[]; players: { left: boolean }[] } }>('select public.game_state($1) as state', [roomId]);
  return result.rows[0].state;
}
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users values ('${alice}'),('${bob}'),('${stranger}');
  `);
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  await db.exec(sql.replace('alter publication supabase_realtime add table public.game_rooms;', ''));
  await db.exec(readFileSync(new URL('../supabase/migrations/002_game_hub.sql', import.meta.url), 'utf8'));
}, 30000);
afterAll(async () => { await db.close(); });

describe('PostgreSQL online room flow', () => {
  it('creates a private room and rejects non-members', async () => {
    await asUser(alice);
    const result = await db.query<{ state: { id: string; code: string } }>('select public.create_game($1,$2::jsonb,30) as state', ['Alice', JSON.stringify(scenarios.slice(0, 3))]);
    roomId = result.rows[0].state.id; code = result.rows[0].state.code;
    expect(code).toMatch(/^[A-F0-9]{8}$/);
    await asUser(stranger);
    await expect(state()).rejects.toThrow('not a member');
  });

  it('joins idempotently and enforces capacity and host-only start', async () => {
    await asUser(bob);
    await db.query('select public.join_game($1,$2)', [code, 'Bob']);
    await db.query('select public.join_game($1,$2)', [code, 'Bob']);
    await expect(db.query('select public.start_game($1)', [roomId])).rejects.toThrow('creator');
    await asUser(stranger);
    await expect(db.query('select public.join_game($1,$2)', [code, 'C'])).rejects.toThrow('full');
    await asUser(alice);
    await db.query('select public.start_game($1)', [roomId]);
    expect((await state()).phase).toBe('answering');
  });
  it('never exposes a single answer and prevents answer overwrites', async () => {
    const answer = { verdict: 1, emotion: 2, factor: 3, explanation: 'Private thoughts' };
    await db.query('select public.answer_game($1,0,$2::jsonb)', [roomId, JSON.stringify(answer)]);
    expect((await state()).answers).toEqual({});
    await db.query('select public.answer_game($1,0,$2::jsonb)', [roomId, JSON.stringify({ ...answer, verdict: 4 })]);
    await asUser(bob);
    expect((await state()).answers).toEqual({});
    await expect(db.query('select public.answer_game($1,0,$2::jsonb)', [roomId, '{"verdict":null}'])).rejects.toThrow('complete');
    await db.query('select public.answer_game($1,0,$2::jsonb)', [roomId, JSON.stringify(answer)]);
    const next = await state();
    expect(next.phase).toBe('discussion');
    expect(next.answers).toEqual({ '0': { [alice]: answer, [bob]: answer } });
  });
  it('enforces server discussion time and requires both players to continue', async () => {
    await expect(db.query('select public.ready_game($1,0)', [roomId])).rejects.toThrow('discuss');
    await db.query("update public.game_rooms set discussion_until = now() - interval '1 second' where id = $1", [roomId]);
    await db.query('select public.ready_game($1,0)', [roomId]);
    await db.query('select public.ready_game($1,0)', [roomId]);
    expect((await state()).ready).toEqual([bob]);
    await asUser(alice);
    await db.query('select public.ready_game($1,0)', [roomId]);
    expect((await state()).round).toBe(1);
    await db.query('select public.ready_game($1,0)', [roomId]);
    expect((await state()).ready).toEqual([]);
  });
  it('completes the remaining rounds and preserves the recap', async () => {
    const answer = JSON.stringify({ verdict: 0, emotion: 0, factor: 0, explanation: '' });
    for (let round = 1; round < 3; round++) {
      await asUser(alice);
      await db.query('select public.answer_game($1,$2,$3::jsonb)', [roomId, round, answer]);
      await asUser(bob);
      await db.query('select public.answer_game($1,$2,$3::jsonb)', [roomId, round, answer]);
      await db.query("update public.game_rooms set discussion_until = now() - interval '1 second' where id = $1", [roomId]);
      await db.query('select public.ready_game($1,$2)', [roomId, round]);
      await asUser(alice);
      await db.query('select public.ready_game($1,$2)', [roomId, round]);
    }
    expect((await state()).phase).toBe('recap');
    expect(Object.keys((await state()).answers)).toHaveLength(3);
    await asUser(bob);
    expect((await state()).phase).toBe('recap');
  });
  it('blocks direct table access and makes explicit departure visible', async () => {
    await db.exec('set role authenticated');
    await expect(db.query('select * from public.game_answers')).rejects.toThrow('permission denied');
    await expect(db.query('select * from public.game_players')).rejects.toThrow('permission denied');
    const visible = await db.query('select id from public.game_rooms');
    expect(visible.rows).toHaveLength(1);
    await asUser(stranger);
    expect((await db.query('select id from public.game_rooms')).rows).toHaveLength(0);
    await db.exec('reset role');
    await asUser(bob);
    await db.query('select public.leave_game($1)', [roomId]);
    await asUser(alice);
    expect((await state()).players.some(p => p.left)).toBe(true);
    await expect(db.query('select public.answer_game($1,1,$2::jsonb)', [roomId, '{"verdict":1,"emotion":1,"factor":1,"explanation":""}'])).rejects.toThrow('left');
  });
});

describe('PostgreSQL multi-game upgrade', () => {
  it('can be reapplied without losing old Same Page answers or membership', async () => {
    await asUser(alice);
    const before = await state();
    await db.exec(readFileSync(new URL('../supabase/migrations/002_game_hub.sql', import.meta.url), 'utf8'));
    expect(await state()).toEqual(before);
    expect(Object.keys((await state()).answers)).toHaveLength(3);
  });

  describe('PostgreSQL playlist game nights', () => {
    let nightId: string;
    let nightCode: string;
    const ids = ['same-page', ...partyGameIds] as const;
    beforeAll(async () => {
      await db.exec(readFileSync(new URL('../supabase/migrations/003_game_nights.sql', import.meta.url), 'utf8'));
    });
    async function nightState() {
      const result = await db.query<{ game: SessionState }>('select public.game_state($1) as game', [nightId]);
      return result.rows[0].game;
    }
    it('validates every game before creating a private playlist room', async () => {
      await asUser(alice);
      const invalid = buildPlaylist(['same-page', 'same-brain'], 3);
      invalid[1].deck = scenarios.slice(0, 3);
      await expect(db.query('select public.create_game_night($1,$2::jsonb,30)', ['Alice', JSON.stringify(invalid)])).rejects.toThrow('options');
      const duplicate = [invalid[0], invalid[0]];
      await expect(db.query('select public.create_game_night($1,$2::jsonb,30)', ['Alice', JSON.stringify(duplicate)])).rejects.toThrow('different');
      const result = await db.query<{ game: SessionState }>('select public.create_game_night($1,$2::jsonb,30) as game', ['Alice', JSON.stringify(buildPlaylist([...ids], 3))]);
      nightId = result.rows[0].game.id; nightCode = result.rows[0].game.code;
      expect(result.rows[0].game.night?.playlist.map(entry => entry.gameType)).toEqual(ids);
      await asUser(stranger);
      await expect(nightState()).rejects.toThrow('not a member');
      await expect(db.query('select public.advance_game_night($1,0)', [nightId])).rejects.toThrow('not a member');
      await asUser(bob);
      await db.query('select public.join_game($1,$2)', [nightCode, 'Bob']);
      await asUser(alice);
      await db.query('select public.start_game($1)', [nightId]);
      await expect(db.query('select public.advance_game_night($1,0)', [nightId])).rejects.toThrow('Finish');
    });
    it('keeps one room, hides each pending answer, and archives all five reports only after mutual readiness', async () => {
      for (const [index, kind] of ids.entries()) {
        expect((await nightState()).gameType).toBe(kind);
        for (let round = 0; round < 3; round++) {
          const answer = kind === 'same-page' ? { verdict: 0, emotion: 1, factor: 2, explanation: 'Our private boundary.' }
            : { choice: 0, explanation: 'Our private game-night answer.', ...(kind === 'pick-my-poison' ? { prediction: 0 } : {}), ...(kind === 'same-brain' && round === 2 ? { matchPrediction: true } : {}) };
          await asUser(alice);
          await db.query('select public.answer_night_game($1,$2,$3,$4::jsonb)', [nightId, index, round, JSON.stringify(answer)]);
          expect((await nightState()).answers[round]).toBeUndefined();
          await asUser(bob);
          expect((await nightState()).answers[round]).toBeUndefined();
          await db.query('select public.answer_night_game($1,$2,$3,$4::jsonb)', [nightId, index, round, JSON.stringify(answer)]);
          expect((await nightState()).answers[round][alice]).toEqual(answer);
          await expect(db.query('select public.ready_night_game($1,$2,$3)', [nightId, index, round])).rejects.toThrow('discuss');
          await db.query("update public.game_rooms set discussion_until = now() - interval '1 second' where id = $1", [nightId]);
          await db.query('select public.ready_night_game($1,$2,$3)', [nightId, index, round]);
          await asUser(alice);
          await db.query('select public.ready_night_game($1,$2,$3)', [nightId, index, round]);
        }
        await db.query('select public.advance_game_night($1,$2)', [nightId, index]);
        await db.query('select public.advance_game_night($1,$2)', [nightId, index]);
        const waiting = await nightState();
        expect(waiting.night?.index).toBe(index);
        expect(waiting.night?.completed).toHaveLength(index);
        expect(waiting.ready).toEqual([alice]);
        await asUser(bob);
        await db.query('select public.advance_game_night($1,$2)', [nightId, index]);
        const next = await nightState();
        expect(next.id).toBe(nightId);
        expect(next.code).toBe(nightCode);
        expect(next.night?.completed).toHaveLength(index + 1);
        expect(next.night?.completed[index].night).toBeUndefined();
        if (index < 4) {
          expect(next.answers).toEqual({});
          expect(next.phase).toBe('answering');
          await db.query('select public.answer_night_game($1,$2,0,$3::jsonb)', [nightId, index, '{"choice":1,"explanation":"stale packet"}']);
          await db.query('select public.ready_night_game($1,$2,0)', [nightId, index]);
          await db.query('select public.advance_game_night($1,$2)', [nightId, index]);
          expect((await nightState()).answers).toEqual({});
          expect((await nightState()).ready).toEqual([]);
        }
      }
      const done = await nightState();
      expect(done.night?.finished).toBe(true);
      expect(nightReflection(done).total).toBe(15);
      expect(nightReportText(done)).toContain('Our private boundary.');
      expect(nightReportText(done)).toContain('Our private game-night answer.');
      await db.query('select public.advance_game_night($1,4)', [nightId]);
      expect((await nightState()).night?.completed).toHaveLength(5);
    });
    it('preserves completed game nights across migration reapplication, refreshes, and departure', async () => {
      await asUser(alice);
      const before = await nightState();
      await db.exec(readFileSync(new URL('../supabase/migrations/003_game_nights.sql', import.meta.url), 'utf8'));
      expect(await nightState()).toEqual(before);
      await asUser(stranger);
      await db.exec('set role authenticated');
      expect((await db.query('select night from public.game_rooms where id = $1', [nightId])).rows).toEqual([]);
      await db.exec('reset role');
      await asUser(bob);
      await db.query('select public.leave_game($1)', [nightId]);
      await asUser(alice);
      expect(nightReflection(await nightState()).total).toBe(15);
    });
    it('supports all one-to-six section deck sizes without changing party-game limits', async () => {
      await asUser(alice);
      for (let length = 1; length <= sections.length; length++) {
        const deck = buildSectionDeck(sections.slice(0, length));
        const result = await db.query<{ game: SessionState }>('select public.create_game($1,$2::jsonb,30) as game', ['Alice', JSON.stringify(deck)]);
        expect(result.rows[0].game.deck).toHaveLength(length * 5);
        expect(result.rows[0].game.gameType).toBe('same-page');
      }
      await expect(db.query('select public.create_game_mode($1,$2::jsonb,30,$3)', ['Alice', JSON.stringify(partyDecks['same-brain'].slice(0, 15)), 'same-brain'])).rejects.toThrow('rounds');
      const plan = buildPlaylist(['same-brain', 'same-page'], 3, ['Boundaries', 'Trust', 'Respect']);
      const result = await db.query<{ game: SessionState }>('select public.create_game_night($1,$2::jsonb,30) as game', ['Alice', JSON.stringify(plan)]);
      expect(result.rows[0].game.night?.playlist.map(entry => entry.deck.length)).toEqual([3, 15]);
    });
  });
  it('validates the mode and deck before creating a party room', async () => {
    await asUser(alice);
    await expect(db.query('select public.create_game_mode($1,$2::jsonb,30,$3)', ['Alice', JSON.stringify(partyDecks['same-brain'].slice(0, 3)), 'unknown'])).rejects.toThrow('available game');
    await expect(db.query('select public.create_game_mode($1,$2::jsonb,30,$3)', ['Alice', JSON.stringify(scenarios.slice(0, 3)), 'same-brain'])).rejects.toThrow('options');
    await expect(db.query('select public.create_game_mode($1,$2::jsonb,30,$3)', ['Alice', JSON.stringify(partyDecks['pick-my-poison'].slice(0, 3)), 'same-brain'])).rejects.toThrow('number of answer');
  });
  for (const kind of partyGameIds) {
    it(`persists and completes ${kind} with private answers, exact scores, and enforced breaks`, async () => {
      await asUser(alice);
      const created = await db.query<{ game: ChoiceGameState }>('select public.create_game_mode($1,$2::jsonb,30,$3) as game', ['Alice', JSON.stringify(partyDecks[kind].slice(0, 3)), kind]);
      const game = created.rows[0].game;
      expect(game.gameType).toBe(kind);
      await asUser(bob);
      await db.query('select public.join_game($1,$2)', [game.code, 'Bob']);
      await asUser(alice);
      await db.query('select public.start_game($1)', [game.id]);
      for (let round = 0; round < 3; round++) {
        const answer = { choice: 0, explanation: 'An honest reason.', ...(kind === 'pick-my-poison' ? { prediction: 0 } : {}), ...(kind === 'same-brain' && round === 2 ? { matchPrediction: true } : {}) };
        if (kind === 'pick-my-poison') await expect(db.query('select public.answer_game($1,$2,$3::jsonb)', [game.id, round, '{"choice":0,"explanation":""}'])).rejects.toThrow('Predict');
        if (kind === 'same-brain' && round === 2) await expect(db.query('select public.answer_game($1,$2,$3::jsonb)', [game.id, round, '{"choice":0,"explanation":""}'])).rejects.toThrow('match prediction');
        await expect(db.query('select public.answer_game($1,$2,$3::jsonb)', [game.id, round, JSON.stringify({ ...answer, choice: -1 })])).rejects.toThrow('valid answer');
        const first = await db.query<{ game: ChoiceGameState }>('select public.answer_game($1,$2,$3::jsonb) as game', [game.id, round, JSON.stringify({ ...answer, points: 999 })]);
        expect(first.rows[0].game.answers[round]).toBeUndefined();
        await db.query('select public.answer_game($1,$2,$3::jsonb)', [game.id, round, JSON.stringify({ ...answer, choice: 1 })]);
        await asUser(bob);
        const revealed = await db.query<{ game: ChoiceGameState }>('select public.answer_game($1,$2,$3::jsonb) as game', [game.id, round, JSON.stringify(answer)]);
        expect(revealed.rows[0].game.phase).toBe('discussion');
        expect(revealed.rows[0].game.answers[round][alice]).toEqual(answer);
        await expect(db.query('select public.ready_game($1,$2)', [game.id, round])).rejects.toThrow('discuss');
        await db.query("update public.game_rooms set discussion_until = now() - interval '1 second' where id = $1", [game.id]);
        await db.query('select public.ready_game($1,$2)', [game.id, round]);
        await asUser(alice);
        await db.query('select public.ready_game($1,$2)', [game.id, round]);
      }
      const restored = await db.query<{ game: ChoiceGameState }>('select public.game_state($1) as game', [game.id]);
      expect(restored.rows[0].game.gameType).toBe(kind);
      expect(restored.rows[0].game.phase).toBe('recap');
      const result = partyRecap(restored.rows[0].game);
      expect(result.total).toBe(3);
      if (kind === 'pick-my-poison') expect(result.players.map(p => p.points)).toEqual([3, 3]);
      if (kind === 'same-brain') { expect(result.sharedPoints).toBe(3); expect(result.players.map(p => p.points)).toEqual([1, 1]); }
      if (kind === 'more-likely') expect(result.sharedPoints).toBe(3);
      if (kind === 'read-the-room') expect(result.players.map(p => p.attempts)).toEqual([1, 2]);
      await asUser(stranger);
      await expect(db.query('select public.game_state($1)', [game.id])).rejects.toThrow('not a member');
    });
  }
});

describe('Fresh question room snapshots', () => {
  it('accepts newly prepared decks and stores the exact same questions for both online players', async () => {
    const host = crypto.randomUUID();
    await db.query('insert into auth.users values ($1)', [host]);
    for (const game of ['same-page', ...partyGameIds] as const) {
      const entry = chooseOfflineQuestions(game === 'same-page' ? { game, count: 30, sections: [...sections] } : { game, count: 3 }, []).entry;
      await asUser(host);
      const result = game === 'same-page'
        ? await db.query<{ state: SessionState }>('select public.create_game($1,$2::jsonb,30) as state', ['Fresh A', JSON.stringify(entry.deck)])
        : await db.query<{ state: SessionState }>('select public.create_game_mode($1,$2::jsonb,30,$3) as state', ['Fresh A', JSON.stringify(entry.deck), game]);
      const created = result.rows[0].state;
      await asUser(bob);
      const joined = await db.query<{ state: SessionState }>('select public.join_game($1,$2) as state', [created.code, 'Fresh B']);
      expect(joined.rows[0].state.deck).toEqual(entry.deck);
      expect(joined.rows[0].state.answers).toEqual({});
      expect(new Set(entry.deck.map(question => question.id)).size).toBe(entry.deck.length);
    }
  });
});

describe('Optional online discussion upgrade', () => {
  beforeAll(async () => {
    const migration = readFileSync(new URL('../supabase/migrations/005_optional_online_discussion.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
  });
  it('lets both players skip an unexpired timer in every game, preserving privacy and duplicate safety', async () => {
    const host = crypto.randomUUID();
    await db.query('insert into auth.users values ($1)', [host]);
    for (const kind of ['same-page', ...partyGameIds] as const) {
      await asUser(host);
      const deck = kind === 'same-page' ? scenarios.slice(0, 3) : partyDecks[kind].slice(0, 3);
      const result = kind === 'same-page'
        ? await db.query<{ game: SessionState }>('select public.create_game($1,$2::jsonb,180) as game', ['A', JSON.stringify(deck)])
        : await db.query<{ game: SessionState }>('select public.create_game_mode($1,$2::jsonb,180,$3) as game', ['A', JSON.stringify(deck), kind]);
      const { id, code } = result.rows[0].game;
      await asUser(bob);
      await db.query('select public.join_game($1,$2)', [code, 'B']);
      await asUser(host);
      await db.query('select public.start_game($1)', [id]);
      for (let round = 0; round < 3; round++) {
        const answer = kind === 'same-page' ? { verdict: 0, emotion: 0, factor: 0, explanation: '' }
          : { choice: 0, explanation: '', ...(kind === 'pick-my-poison' ? { prediction: 0 } : {}), ...(kind === 'same-brain' && round === 2 ? { matchPrediction: true } : {}) };
        await asUser(host);
        await db.query('select public.answer_game($1,$2,$3::jsonb)', [id, round, JSON.stringify(answer)]);
        await expect(db.query('select public.ready_game($1,$2)', [id, round])).rejects.toThrow('not active');
        await asUser(bob);
        await db.query('select public.answer_game($1,$2,$3::jsonb)', [id, round, JSON.stringify(answer)]);
        const first = (await db.query<{ game: SessionState }>('select public.ready_game($1,$2) as game', [id, round])).rows[0].game;
        expect(first.discussionUntil).toBeGreaterThan(Date.now());
        expect(first.phase).toBe('discussion');
        expect(first.round).toBe(round);
        expect(first.ready).toEqual([bob]);
        expect(Object.keys(first.answers[round])).toHaveLength(2);
        const duplicate = (await db.query<{ game: SessionState }>('select public.ready_game($1,$2) as game', [id, round])).rows[0].game;
        expect(duplicate.revision).toBe(first.revision);
        await asUser(stranger);
        await expect(db.query('select public.ready_game($1,$2)', [id, round])).rejects.toThrow('not a member');
        await asUser(host);
        const both = (await db.query<{ game: SessionState }>('select public.ready_game($1,$2) as game', [id, round])).rows[0].game;
        expect(both.phase).toBe(round === 2 ? 'recap' : 'answering');
        expect(both.ready).toEqual([]);
        expect(both.discussionUntil).toBeNull();
        const stale = (await db.query<{ game: SessionState }>('select public.ready_game($1,$2) as game', [id, round])).rows[0].game;
        expect(stale.revision).toBe(both.revision);
      }
    }
  });
  it('supports playlist skips without weakening index guards or departure checks', async () => {
    const host = crypto.randomUUID();
    await db.query('insert into auth.users values ($1)', [host]);
    await asUser(host);
    const result = await db.query<{ game: SessionState }>('select public.create_game_night($1,$2::jsonb,180) as game', ['A', JSON.stringify(buildPlaylist(['same-brain', 'more-likely'], 3))]);
    const { id, code } = result.rows[0].game;
    await asUser(bob);
    await db.query('select public.join_game($1,$2)', [code, 'B']);
    await asUser(host);
    await db.query('select public.start_game($1)', [id]);
    await expect(db.query('select public.ready_night_game($1,1,0)', [id])).rejects.toThrow('not active');
    const answer = JSON.stringify({ choice: 0, explanation: '' });
    await db.query('select public.answer_night_game($1,0,0,$2::jsonb)', [id, answer]);
    await asUser(bob);
    await db.query('select public.answer_night_game($1,0,0,$2::jsonb)', [id, answer]);
    const first = (await db.query<{ game: SessionState }>('select public.ready_night_game($1,0,0) as game', [id])).rows[0].game;
    expect(first.discussionUntil).toBeGreaterThan(Date.now());
    expect(first.ready).toEqual([bob]);
    await asUser(host);
    const both = (await db.query<{ game: SessionState }>('select public.ready_night_game($1,0,0) as game', [id])).rows[0].game;
    expect(both.round).toBe(1);
    expect(both.night?.index).toBe(0);
    await asUser(bob);
    await db.query('select public.leave_game($1)', [id]);
    await asUser(host);
    await expect(db.query('select public.ready_night_game($1,0,1)', [id])).rejects.toThrow('left');
  });
});
