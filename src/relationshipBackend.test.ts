import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { adventureIds, adventureState, buildAdventureDeck, type AdventureId } from './adventures';
import { createChoiceGame, demoChoiceAnswer, partyReportText, submitChoiceAnswer } from './party';
import type { ChoiceAnswer, ChoiceGameState } from './game';
import { empathyQuestions, repairQuestions } from './relationshipGames';
import { buildPlaylist } from './night';
import { games } from './catalog';
import { offlineBank } from './offlineQuestions';
import { chooseReplacement, replacementQuestions } from './questionSwitching';
import { isChoiceGame, type SessionState } from './game';

const db = new PGlite();
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
const asUser = (id: string) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
async function rpc(name: string, args: unknown[]): Promise<ChoiceGameState> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(',');
  const result = await db.query<{ game: ChoiceGameState }>(`select public.${name}(${placeholders}) as game`, args);
  return result.rows[0].game;
}
async function room(kind: string, deck: unknown[]) {
  await asUser(alice);
  const game = await rpc(kind === 'same-page' ? 'create_game' : 'create_game_mode', kind === 'same-page'
    ? ['Mia', JSON.stringify(deck), 30] : ['Mia', JSON.stringify(deck), 30, kind]);
  await asUser(bob); await rpc('join_game', [game.code, 'Sam']);
  await asUser(alice); return rpc('start_game', [game.id]);
}
async function continueRoom(game: ChoiceGameState) {
  await asUser(alice); await rpc('ready_game', [game.id, game.round]);
  await asUser(bob); return rpc('ready_game', [game.id, game.round]);
}
function planned(world: AdventureId, round: number, player: number, good: boolean): ChoiceAnswer {
  if (world === 'stranded' && round === 0) return { choice: good ? 0 : 3, items: good ? [0, 1, 2] : [3, 4, 5], explanation: '' };
  const opening = world === 'restaurant' || world === 'spaceship' ? [0, 1] : [0, 1];
  const second = world === 'restaurant' ? [1, 1] : world === 'aliens' ? [2, 1] : world === 'spaceship' ? [2, 3] : [3, 3];
  return { choice: good && round < 2 ? (round === 0 ? opening : second)[player] : 3, explanation: '' };
}
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users values('${alice}'),('${bob}'),('${outsider}');`);
  await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8').replace('alter publication supabase_realtime add table public.game_rooms;', ''));
  for (const migration of ['002_game_hub.sql', '003_game_nights.sql', '004_fresh_questions.sql', '005_optional_online_discussion.sql', '006_both_players_choice.sql', '007_relationship_adventures.sql', '008_switch_questions.sql', '009_written_answers.sql']) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
  }
}, 30000);
afterAll(() => db.close());

describe('New games through real PostgreSQL room RPCs', () => {
  it('keeps two empathy responses private, validates both choices, deduplicates submissions and restores exact reveals', async () => {
    const game = await room('if-i-were-you', empathyQuestions.slice(0, 3));
    await asUser(outsider); await expect(rpc('game_state', [game.id])).rejects.toThrow('not a member');
    await asUser(alice);
    await expect(rpc('answer_game', [game.id, 0, JSON.stringify({ choice: 0, explanation: '' })])).rejects.toThrow('partner');
    const first = await rpc('answer_game', [game.id, 0, JSON.stringify({ choice: 0, prediction: 4, explanation: 'Private until reveal.' })]);
    expect(first.answers[0]).toBeUndefined();
    await rpc('answer_game', [game.id, 0, JSON.stringify({ choice: 2, prediction: 2, explanation: '' })]);
    await asUser(bob);
    expect((await rpc('game_state', [game.id])).answers[0]).toBeUndefined();
    const revealed = await rpc('answer_game', [game.id, 0, JSON.stringify({ choice: 4, prediction: 0, explanation: '' })]);
    expect(revealed.phase).toBe('discussion');
    expect(revealed.answers[0][alice].choice).toBe(0);
    expect(revealed.answers[0][bob].choice).toBe(4);
    expect((await rpc('game_state', [game.id])).answers).toEqual(revealed.answers);
  });
  it('persists private reflections only for their author, honours sharing and revocation, and excludes private text from room rows', async () => {
    const game = await room('if-i-were-you', empathyQuestions.slice(0, 3));
    for (const id of [alice, bob]) { await asUser(id); await rpc('answer_game', [game.id, 0, JSON.stringify({ choice: 0, prediction: 0, explanation: '' })]); }
    await asUser(alice);
    await expect(rpc('save_game_reflection', [game.id, 0, '{"reaction":null,"explanation":"","shared":false}', null])).rejects.toThrow('Invalid reaction');
    await rpc('save_game_reflection', [game.id, 0, JSON.stringify({ reaction: "It's more complicated", explanation: 'Author-only note.', shared: false }), null]);
    const mine = await db.query<{ notes: { reflections: Record<string, { explanation: string }> } }>('select public.my_game_notes($1) as notes', [game.id]);
    expect(mine.rows[0].notes.reflections[0].explanation).toBe('Author-only note.');
    await asUser(bob);
    expect(JSON.stringify(await rpc('game_state', [game.id]))).not.toContain('Author-only note.');
    const theirs = await db.query<{ notes: unknown }>('select public.my_game_notes($1) as notes', [game.id]);
    expect(JSON.stringify(theirs.rows[0].notes)).not.toContain('Author-only note.');
    const raw = await db.query<{ data: string }>('select row_to_json(r)::text data from public.game_rooms r where id=$1', [game.id]);
    expect(raw.rows[0].data).not.toContain('Author-only note.');
    await asUser(alice);
    const shared = { reaction: 'Tell me more', explanation: 'Shared by consent.', shared: true };
    await rpc('save_game_reflection', [game.id, 0, JSON.stringify(shared), null]);
    await asUser(bob); expect((await rpc('game_state', [game.id])).reflections?.[0]?.[alice].explanation).toBe(shared.explanation);
    await asUser(alice); await rpc('save_game_reflection', [game.id, 0, JSON.stringify({ ...shared, shared: false }), null]);
    await asUser(bob); expect(JSON.stringify((await rpc('game_state', [game.id])).reflections)).not.toContain(shared.explanation);
  });
  it('lets either partner skip a sensitive question, redacts both answers and continues without a timer requirement', async () => {
    const game = await room('when-things-get-hard', repairQuestions.slice(0, 3));
    await asUser(alice); await rpc('answer_game', [game.id, 0, JSON.stringify({ choice: 0, explanation: 'Sensitive answer.' })]);
    await asUser(bob);
    const skipped = await rpc('answer_game', [game.id, 0, '{"skip":true}']);
    expect(skipped.skippedRounds).toEqual([0]); expect(skipped.answers[0]).toBeUndefined();
    await asUser(alice); expect(JSON.stringify(await rpc('game_state', [game.id]))).not.toContain('Sensitive answer.');
    expect((await continueRoom(skipped)).round).toBe(1);
    await asUser(bob); await expect(rpc('save_game_reflection', [game.id, 0, '{"explanation":"late","shared":true}', null])).rejects.toThrow('current revealed');
    for (const id of [alice, bob]) { await asUser(id); await rpc('answer_game', [game.id, 1, '{"choice":0,"explanation":""}']); }
    await expect(rpc('save_game_reflection', [game.id, 1, '{"kind":null,"explanation":"","shared":false}', null])).rejects.toThrow('Invalid reflection type');
  });
  it('rejects malformed response meanings and adventure effects before storing a room', async () => {
    const empathy = structuredClone(empathyQuestions.slice(0, 3));
    await asUser(alice);
    await expect(rpc('create_game_mode', ['Mia', JSON.stringify([{ ...empathy[0], tags: [null, 'space', 'talk', 'impact', 'pause'] }, ...empathy.slice(1)]), 30, 'if-i-were-you'])).rejects.toThrow('Invalid response meaning');
    const deck = buildAdventureDeck('spaceship');
    const malformed = JSON.parse(JSON.stringify(deck));
    malformed[0].adventure.actions[0].grants = [null];
    await expect(rpc('create_game_mode', ['Mia', JSON.stringify(malformed), 30, 'us-against-the-world'])).rejects.toThrow('flags');
    malformed[0] = { ...deck[0], adventure: { ...deck[0].adventure, surprise: { cost: 2, unless: 'hull' } } };
    await expect(rpc('create_game_mode', ['Mia', JSON.stringify(malformed), 30, 'us-against-the-world'])).rejects.toThrow('feedback');
  });
  it('enforces the exact per-player resource allowance and retains an affordable fallback', async () => {
    let game = await room('us-against-the-world', buildAdventureDeck('spaceship'));
    for (const round of [0, 1, 2, 3]) {
      for (const id of [alice, bob]) {
        await asUser(id);
        game = await rpc('answer_game', [game.id, round, JSON.stringify({ choice: round === 1 ? 2 : 0, explanation: '' })]);
      }
      game = await continueRoom(game);
    }
    await asUser(alice);
    await expect(rpc('answer_game', [game.id, 4, '{"choice":0,"explanation":""}'])).rejects.toThrow('resources');
    await rpc('answer_game', [game.id, 4, '{"choice":3,"explanation":""}']);
    await asUser(bob);
    game = await rpc('answer_game', [game.id, 4, '{"choice":3,"explanation":""}']);
    expect(game.phase).toBe('discussion');
  });
  for (const world of adventureIds) for (const good of [true, false]) {
    it(`synchronises ${world} through five chapters to its ${good ? 'full' : 'alternative'} ending`, async () => {
      let online = await room('us-against-the-world', buildAdventureDeck(world));
      expect(online.deck.every(scene => scene.adventure?.clues === undefined)).toBe(true);
      for (const scene of online.deck) expect(JSON.stringify(scene)).not.toContain('"clues"');
      let local = createChoiceGame('us-against-the-world', 'local', ['Mia', 'Sam'], 5, 30, buildAdventureDeck(world));
      for (let round = 0; round < 5; round++) {
        const before = await db.query<{ state: { resources: number; flags: string[] } }>('select public.adventure_before($1) state', [online.id]);
        expect(before.rows[0].state.resources).toBe(adventureState(local, round, false).resources);
        expect([...new Set(before.rows[0].state.flags)].sort()).toEqual([...adventureState(local, round, false).flags].sort());
        await asUser(bob);
        await expect(rpc('answer_game', [online.id, round, JSON.stringify(planned(world, round, 1, good))])).rejects.toThrow('turn');
        for (const [index, id] of [alice, bob].entries()) {
          await asUser(id);
          const answer = planned(world, round, index, good);
          online = await rpc('answer_game', [online.id, round, JSON.stringify(answer)]);
          local = submitChoiceAnswer(local, local.players[index].id, answer);
          if (index === 0) expect(online.answers[round]).toBeUndefined();
        }
        expect(adventureState(online, round).resources).toBe(adventureState(local, round).resources);
        expect(adventureState(online, round).flags).toEqual(adventureState(local, round).flags);
        const restored = await rpc('game_state', [online.id]);
        expect(restored.answers).toEqual(online.answers);
        online = await continueRoom(online);
        local = { ...local, round: Math.min(round + 1, 4), phase: round === 4 ? 'recap' : 'answering', submitted: [], discussionUntil: null };
      }
      expect(online.phase).toBe('recap');
      expect(adventureState(online, 4).achieved).toBe(good);
      expect(partyReportText(online)).not.toMatch(/\d+ points?|\d+%/);
    });
  }
  it('returns different private clues to the two identities and rejects unaffordable actions', async () => {
    const game = await room('us-against-the-world', buildAdventureDeck('aliens'));
    await asUser(alice);
    const first = await db.query<{ notes: { clues: Record<string, string> } }>('select public.my_game_notes($1) as notes', [game.id]);
    await asUser(bob);
    const second = await db.query<{ notes: { clues: Record<string, string> } }>('select public.my_game_notes($1) as notes', [game.id]);
    expect(first.rows[0].notes.clues[0]).not.toBe(second.rows[0].notes.clues[0]);
    expect(JSON.stringify(await rpc('game_state', [game.id]))).not.toContain(first.rows[0].notes.clues[0]);
    const denied = await db.query<{ allowed: boolean }>("select has_table_privilege('authenticated','public.game_clues','SELECT') allowed");
    expect(denied.rows[0].allowed).toBe(false);
    const bypass = await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.answer_game_v006(uuid,integer,jsonb)','EXECUTE') allowed");
    expect(bypass.rows[0].allowed).toBe(false);
    await db.query('update public.game_rooms set round=1 where id=$1', [game.id]);
    await asUser(alice);
    await expect(rpc('answer_game', [game.id, 1, '{"choice":0,"explanation":""}'])).rejects.toThrow('incomplete');
  });
  it('completes an online mixed playlist and keeps old-game requests from changing the next game', async () => {
    const plan = buildPlaylist(['when-things-get-hard', 'if-i-were-you', 'us-against-the-world'], 3);
    await asUser(alice);
    let game = await rpc('create_game_night', ['Mia', JSON.stringify(plan), 30]);
    await asUser(bob); await rpc('join_game', [game.code, 'Sam']);
    await asUser(alice); game = await rpc('start_game', [game.id]);
    while (!game.night?.finished) {
      const index = game.night!.index;
      while (game.phase === 'answering') {
        for (const id of [alice, bob]) {
          await asUser(id);
          const answer = demoChoiceAnswer(game);
          game = await rpc('answer_night_game', [game.id, index, game.round, JSON.stringify(answer)]);
        }
        game = await continueRoom(game);
      }
      await asUser(alice); await rpc('advance_game_night', [game.id, index]);
      await asUser(bob); game = await rpc('advance_game_night', [game.id, index]);
      if (!game.night!.finished) {
        const delayed = await rpc('answer_night_game', [game.id, index, 0, '{"choice":0,"explanation":""}']);
        expect(delayed.night?.index).toBe(index + 1);
        expect(delayed.submitted).toHaveLength(0);
      }
    }
    expect(game.night!.completed).toHaveLength(3);
    const stored = await db.query<{ night: unknown }>('select night from public.game_rooms where id=$1', [game.id]);
    expect(JSON.stringify(stored.rows[0].night)).not.toContain('"clues"');
  });
  it('rejects turns after a departure and applies the new migration idempotently', async () => {
    const game = await room('us-against-the-world', buildAdventureDeck('spaceship'));
    await asUser(bob); await rpc('leave_game', [game.id]);
    await asUser(alice); await expect(rpc('answer_game', [game.id, 0, '{"choice":0,"explanation":""}'])).rejects.toThrow('left');
    await db.exec(readFileSync(new URL('../supabase/migrations/007_relationship_adventures.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/008_switch_questions.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/009_written_answers.sql', import.meta.url), 'utf8'));
    expect((await rpc('game_state', [game.id])).id).toBe(game.id);
  });
});

describe('Synchronized question switching', () => {
  beforeEach(() => db.exec('delete from public.game_rooms'));

  it('permits more than three synchronized switches without a per-game cap', async () => {
    let game = await room('same-page', offlineBank('same-page').slice(0, 3));
    for (let index = 0; index < 5; index++) {
      game = await rpc('switch_game_question', [game.id, 0, game.deck[0].id, JSON.stringify(chooseReplacement(game)), null]);
      expect(game.switchedQuestions).toHaveLength(index + 1);
      expect(game.round).toBe(0);
      expect(game.deck).toHaveLength(3);
    }
    await asUser(bob);
    expect((await rpc('game_state', [game.id])).switchedQuestions).toEqual(game.switchedQuestions);
  });

  it.each(games.filter(game => game.id !== 'us-against-the-world'))('replaces $title for both identities and rejects stale answers, retries and post-submission switches safely', async definition => {
    let game = await room(definition.id, offlineBank(definition.id).slice(0, 3));
    const original = game.deck[0];
    const replacement = chooseReplacement(game);
    const request = [game.id, 0, original.id, JSON.stringify(replacement), null];
    await asUser(outsider); await expect(rpc('switch_game_question', request)).rejects.toThrow('not a member');
    await asUser(alice);
    game = await rpc('switch_game_question', request);
    expect(game.deck[0]).toEqual(replacement);
    expect(game.switchedQuestions).toEqual([{ id: original.id, text: original.text }]);
    expect((await rpc('switch_game_question', request)).revision).toBe(game.revision);
    await asUser(bob);
    expect((await rpc('game_state', [game.id])).deck).toEqual(game.deck);
    const answer = (current: SessionState) => isChoiceGame(current) ? demoChoiceAnswer(current) : { verdict: 0, emotion: 0, factor: 0, explanation: '' };
    await expect(rpc('answer_game', [game.id, 0, JSON.stringify({ ...answer(game), questionId: original.id })])).rejects.toThrow('switched');
    await expect(rpc('answer_game', [game.id, 0, JSON.stringify(answer(game))])).rejects.toThrow('switched');
    expect((await rpc('game_state', [game.id])).submitted).toHaveLength(0);
    const other = chooseReplacement(game);
    await expect(rpc('switch_game_question', [game.id, 0, original.id, JSON.stringify(other), null])).rejects.toThrow('changed');
    const first = await rpc('answer_game', [game.id, 0, JSON.stringify({ ...answer(game), questionId: replacement.id })]);
    expect(first.answers[0]).toBeUndefined();
    await asUser(alice);
    await expect(rpc('switch_game_question', [game.id, 0, replacement.id, JSON.stringify(other), null])).rejects.toThrow('before either');
    const revealed = await rpc('answer_game', [game.id, 0, JSON.stringify({ ...answer(game), questionId: replacement.id })]);
    expect(revealed.phase).toBe('discussion');
    expect(Object.keys(revealed.answers[0])).toHaveLength(2);
    expect(revealed.deck[0].id).toBe(replacement.id);
  });

  it('excludes every prior replacement, disallows duplicate text, and validates categories and content', async () => {
    let game = await room('if-i-were-you', empathyQuestions.slice(0, 3));
    const original = game.deck[0];
    const replacement = chooseReplacement(game);
    await expect(rpc('switch_game_question', [game.id, 0, original.id, JSON.stringify({ ...replacement, text: `  ${original.text.toUpperCase()}  ` }), null])).rejects.toThrow('already in this game');
    await expect(rpc('switch_game_question', [game.id, 0, original.id, JSON.stringify({ ...replacement, options: ['one'] }), null])).rejects.toThrow('option');
    await expect(rpc('switch_game_question', [game.id, 0, original.id, JSON.stringify({ ...replacement, category: 'Different category' }), null])).rejects.toThrow('category');
    game = await rpc('switch_game_question', [game.id, 0, original.id, JSON.stringify(replacement), null]);
    await expect(rpc('switch_game_question', [game.id, 0, replacement.id, JSON.stringify(original), null])).rejects.toThrow('set aside');
    const next = chooseReplacement(game);
    game = await rpc('switch_game_question', [game.id, 0, replacement.id, JSON.stringify(next), null]);
    expect(game.switchedQuestions).toHaveLength(2);
    expect(replacementQuestions(game)).toHaveLength(0);
    await expect(rpc('answer_game', [game.id, 0, JSON.stringify({ skip: true, questionId: original.id })])).rejects.toThrow('switched');
  });

  it('preserves Pick My Poison difficulty and never switches adventure chapters', async () => {
    const poison = await room('pick-my-poison', offlineBank('pick-my-poison').slice(0, 3));
    const replacement = chooseReplacement(poison);
    await expect(rpc('switch_game_question', [poison.id, 0, poison.deck[0].id, JSON.stringify({ ...replacement, level: 3 }), null])).rejects.toThrow('difficulty');
    const adventure = await room('us-against-the-world', buildAdventureDeck('stranded'));
    await expect(rpc('switch_game_question', [adventure.id, 0, adventure.deck[0].id, JSON.stringify(replacement), null])).rejects.toThrow('story order');
  });

  it('saves playlist replacements and history, rejects stale indexes and allows clean next-game answers', async () => {
    await asUser(alice);
    const plan = buildPlaylist(['if-i-were-you', 'when-things-get-hard'], 3);
    let game = await rpc('create_game_night', ['Mia', JSON.stringify(plan), 30]);
    await asUser(bob); await rpc('join_game', [game.code, 'Sam']);
    await asUser(alice); game = await rpc('start_game', [game.id]);
    const old = game.deck[0];
    const replacement = chooseReplacement(game);
    await expect(rpc('switch_game_question', [game.id, 0, old.id, JSON.stringify(replacement), null])).rejects.toThrow('playlist game has changed');
    game = await rpc('switch_game_question', [game.id, 0, old.id, JSON.stringify(replacement), 0]);
    expect(game.night?.playlist[0].deck).toEqual(game.deck);
    for (let round = 0; round < 3; round++) {
      for (const id of [alice, bob]) {
        await asUser(id);
        game = await rpc('answer_night_game', [game.id, 0, round, JSON.stringify({ choice: 0, prediction: 0, explanation: '', questionId: game.deck[round].id })]);
      }
      game = await continueRoom(game);
    }
    await asUser(alice); await rpc('advance_game_night', [game.id, 0]);
    await asUser(bob); game = await rpc('advance_game_night', [game.id, 0]);
    expect(game.switchedQuestions).toEqual([]);
    expect(game.night?.completed[0].switchedQuestions?.[0].id).toBe(old.id);
    expect(game.night?.completed[0].deck[0].id).toBe(replacement.id);
    await expect(rpc('switch_game_question', [game.id, 0, old.id, JSON.stringify(replacement), 0])).rejects.toThrow('playlist game has changed');
    game = await rpc('answer_night_game', [game.id, 1, 0, '{"choice":0,"explanation":""}']);
    expect(game.submitted).toHaveLength(1);
  });

  it('guards expiry/departures, keeps helper tables private and reapplies migration 008 safely', async () => {
    let game = await room('if-i-were-you', empathyQuestions.slice(0, 3));
    const replacement = chooseReplacement(game);
    await db.exec(readFileSync(new URL('../supabase/migrations/008_switch_questions.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/009_written_answers.sql', import.meta.url), 'utf8'));
    game = await rpc('switch_game_question', [game.id, 0, game.deck[0].id, JSON.stringify(replacement), null]);
    const permission = await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.answer_game_v007(uuid,integer,jsonb)','execute') or has_table_privilege('authenticated','public.game_question_switches','select') allowed");
    expect(permission.rows[0].allowed).toBe(false);
    await asUser(bob); await rpc('leave_game', [game.id]);
    await asUser(alice);
    await expect(rpc('switch_game_question', [game.id, 0, game.deck[0].id, JSON.stringify(chooseReplacement(game)), null])).rejects.toThrow('Both players');
    await db.query("update public.game_rooms set expires_at=now()-interval '1 second' where id=$1", [game.id]);
    await expect(rpc('switch_game_question', [game.id, 0, game.deck[0].id, JSON.stringify(chooseReplacement(game)), null])).rejects.toThrow('expired');
  });

  describe('Private written answers through room RPCs', () => {
    beforeEach(() => db.exec('delete from public.game_rooms'));
    const page = { verdict: -2, emotion: -2, factor: -2, customVerdict: 'I need more context.', customEmotion: 'Surprised, not upset.', customFactor: 'Our understanding of the agreement.', explanation: '' };
    const choice = (kind: string) => ({ choice: -2, customChoice: 'An answer in my own words.', ...(['pick-my-poison', 'if-i-were-you'].includes(kind) ? { prediction: -2, customPrediction: 'My guess in my own words.' } : {}), explanation: '' });
    it.each(games.filter(game => game.id !== 'us-against-the-world'))('persists and reveals $title written answers only after both submit', async definition => {
      let game = await room(definition.id, offlineBank(definition.id).slice(0, 3));
      const payload = definition.id === 'same-page' ? page : choice(definition.id);
      await asUser(outsider); await expect(rpc('answer_game', [game.id, 0, JSON.stringify(payload)])).rejects.toThrow('not a member');
      await asUser(alice);
      const first = await rpc('answer_game', [game.id, 0, JSON.stringify(payload)]);
      expect(first.answers[0]).toBeUndefined();
      await rpc('answer_game', [game.id, 0, JSON.stringify({ ...payload, explanation: 'Duplicate must not overwrite.' })]);
      await asUser(bob);
      expect((await rpc('game_state', [game.id])).answers[0]).toBeUndefined();
      const revealed = await rpc('answer_game', [game.id, 0, JSON.stringify(payload)]);
      expect(revealed.phase).toBe('discussion');
      expect(revealed.answers[0][alice]).toEqual(payload);
      expect(revealed.answers[0][bob]).toEqual(payload);
      expect((await rpc('game_state', [game.id])).answers).toEqual(revealed.answers);
      game = await continueRoom(revealed);
      for (let round = 1; round < 3; round++) {
        const nextPayload = { ...payload, ...(definition.id === 'same-brain' && round === 2 ? { matchPrediction: true } : {}) };
        for (const id of [alice, bob]) { await asUser(id); game = await rpc('answer_game', [game.id, round, JSON.stringify(nextPayload)]); }
        expect(game.answers[round][alice]).toEqual(nextPayload);
        game = await continueRoom(game);
      }
      expect(game.phase).toBe('recap');
    });
    it('validates required text, whitespace, types, ranges, UTF-16 limits and partner predictions', async () => {
      const game = await room('if-i-were-you', empathyQuestions.slice(0, 3));
      await asUser(alice);
      for (const text of [null, '', ' \n\t', '\u00a0\ufeff', 42, 'x'.repeat(601), '😀'.repeat(301)]) {
        await expect(rpc('answer_game', [game.id, 0, JSON.stringify({ ...choice('if-i-were-you'), customChoice: text })])).rejects.toThrow(/Write|Written/);
      }
      for (const invalid of [
        { ...choice('if-i-were-you'), customPrediction: '' },
        { ...choice('if-i-were-you'), choice: -1 },
        { ...choice('if-i-were-you'), choice: 5 },
        { ...choice('if-i-were-you'), choice: 0 },
        { ...choice('if-i-were-you'), prediction: undefined },
      ]) await expect(rpc('answer_game', [game.id, 0, JSON.stringify(invalid)])).rejects.toThrow(/response|Write|Written/);
      const valid = { choice: -2, customChoice: '😀'.repeat(300), prediction: -2, customPrediction: 'x'.repeat(600), explanation: '' };
      await rpc('answer_game', [game.id, 0, JSON.stringify(valid)]);
      await asUser(bob);
      const revealed = await rpc('answer_game', [game.id, 0, JSON.stringify({ choice: 0, prediction: 4, explanation: '' })]);
      expect(revealed.answers[0][alice]).toEqual(valid);
    });
    it('validates the three Same Page fields separately and preserves mixed predefined axes', async () => {
      const game = await room('same-page', offlineBank('same-page').slice(0, 3));
      await asUser(alice);
      for (const field of ['customVerdict', 'customEmotion', 'customFactor']) {
        await expect(rpc('answer_game', [game.id, 0, JSON.stringify({ ...page, [field]: '' })])).rejects.toThrow('Written');
      }
      const mixed = { verdict: -2, customVerdict: 'Ask first.', emotion: 0, factor: 0, explanation: '' };
      await rpc('answer_game', [game.id, 0, JSON.stringify(mixed)]);
      await asUser(bob);
      const revealed = await rpc('answer_game', [game.id, 0, JSON.stringify({ verdict: 0, emotion: 0, factor: 0, explanation: '' })]);
      expect(revealed.answers[0][alice]).toEqual(mixed);
    });
    it('retains switched-question guards and sensitive-skip redaction for written answers', async () => {
      let game = await room('when-things-get-hard', repairQuestions.slice(0, 3));
      await asUser(alice);
      const original = game.deck[0].id;
      game = await rpc('switch_game_question', [game.id, 0, original, JSON.stringify(chooseReplacement(game)), null]);
      for (const questionId of [original, undefined]) await expect(rpc('answer_game', [game.id, 0, JSON.stringify({ ...choice(game.gameType), questionId })])).rejects.toThrow('switched');
      await rpc('answer_game', [game.id, 0, JSON.stringify({ ...choice(game.gameType), questionId: game.deck[0].id })]);
      await asUser(bob);
      const skipped = await rpc('answer_game', [game.id, 0, JSON.stringify({ skip: true, questionId: game.deck[0].id })]);
      expect(skipped.answers[0]).toBeUndefined();
      expect(skipped.skippedRounds).toContain(0);
      expect((await rpc('answer_game', [game.id, 0, JSON.stringify(choice(game.gameType))])).answers[0]).toBeUndefined();
    });
    it('requires final match forecasts, rejects adventure Other actions and preserves departure/expiry checks', async () => {
      let game = await room('same-brain', offlineBank('same-brain').slice(0, 3));
      for (let round = 0; round < 2; round++) {
        for (const id of [alice, bob]) { await asUser(id); await rpc('answer_game', [game.id, round, JSON.stringify(choice(game.gameType))]); }
        game = await continueRoom(game);
      }
      await asUser(alice);
      await expect(rpc('answer_game', [game.id, 2, JSON.stringify(choice(game.gameType))])).rejects.toThrow('final-round');
      await rpc('answer_game', [game.id, 2, JSON.stringify({ ...choice(game.gameType), matchPrediction: true })]);
      const adventure = await room('us-against-the-world', buildAdventureDeck('spaceship'));
      await expect(rpc('answer_game', [adventure.id, 0, JSON.stringify(choice(adventure.gameType))])).rejects.toThrow('Adventure actions');
      await asUser(bob); await rpc('leave_game', [adventure.id]);
      await asUser(alice); await expect(rpc('answer_game', [adventure.id, 0, JSON.stringify(choice(adventure.gameType))])).rejects.toThrow('left');
      await db.query("update public.game_rooms set expires_at=now()-interval '1 second' where id=$1", [game.id]);
      await expect(rpc('answer_game', [game.id, 2, JSON.stringify({ ...choice(game.gameType), matchPrediction: false })])).rejects.toThrow('expired');
    });
    it('can reapply 009 without exposing validation helpers or old answer entry points', async () => {
      await db.exec(readFileSync(new URL('../supabase/migrations/009_written_answers.sql', import.meta.url), 'utf8'));
      const permission = await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.answer_game_v008(uuid,integer,jsonb)','execute') or has_function_privilege('authenticated','public.validated_response(jsonb,text,text,integer)','execute') or has_function_privilege('authenticated','public.assert_answer_question(public.game_rooms,integer,jsonb)','execute') allowed");
      expect(permission.rows[0].allowed).toBe(false);
    });
    it('retains written answers in online playlist archives and rejects delayed game-index writes', async () => {
      await asUser(alice);
      const playlist = buildPlaylist(['same-page', 'if-i-were-you'], 3);
      let game = await rpc('create_game_night', ['Mia', JSON.stringify(playlist), 30]);
      await asUser(bob); await rpc('join_game', [game.code, 'Sam']);
      await asUser(alice); game = await rpc('start_game', [game.id]);
      for (let index = 0; index < 2; index++) {
        for (let round = 0; round < 3; round++) {
          const payload = index === 0 ? page : choice('if-i-were-you');
          for (const id of [alice, bob]) {
            await asUser(id);
            game = await rpc('answer_night_game', [game.id, index, round, JSON.stringify({ ...payload, questionId: game.deck[round].id })]);
          }
          game = await continueRoom(game);
        }
        await asUser(alice); await rpc('advance_game_night', [game.id, index]);
        await asUser(bob); game = await rpc('advance_game_night', [game.id, index]);
        if (index === 0) {
          const delayed = await rpc('answer_night_game', [game.id, 0, 0, JSON.stringify(page)]);
          expect(delayed.night?.index).toBe(1);
          expect(delayed.submitted).toEqual([]);
        }
      }
      expect(game.night?.finished).toBe(true);
      expect(game.night?.completed[0].answers[0][alice]).toEqual(page);
      expect(game.night?.completed[1].answers[0][alice]).toEqual(choice('if-i-were-you'));
    });
  });
});
