import { describe, expect, it } from 'vitest';
import { buildDeck, partyDecks, partyGameIds, type PartyGameId } from './catalog';
import { readyForNext, type ChoiceAnswer } from './game';
import { createChoiceGame, demoChoiceAnswer, isBonusRound, optionLabels, partyRecap, partyReportText, scorePartyRound, submitChoiceAnswer, validChoiceAnswer } from './party';

const choice = (n: number, extra: Partial<ChoiceAnswer> = {}): ChoiceAnswer => ({ choice: n, explanation: '', ...extra });
const make = (id: PartyGameId) => createChoiceGame(id, 'local', ['Mia', 'Sam'], 3, 30);

describe('four distinct game mechanics', () => {
  it('seeds 20 unique editable questions per game with valid answer options', () => {
    for (const id of partyGameIds) {
      const deck = partyDecks[id];
      expect(deck).toHaveLength(20);
      expect(new Set(deck.map(s => s.id)).size).toBe(20);
      expect(deck.every(s => s.text && s.title && s.prompt)).toBe(true);
      expect(deck.every(s => s.options.length === (id === 'same-brain' || id === 'read-the-room' ? 4 : 2))).toBe(true);
    }
  });
  it('keeps short Poison decks unique, progressively ridiculous, and ends at the wildest level', () => {
    for (const count of [3, 5, 10, 20]) {
      const deck = buildDeck('pick-my-poison', count);
      expect(deck).toHaveLength(count);
      expect(new Set(deck.map(s => s.id)).size).toBe(count);
      expect(deck[0].text).toContain('music for a year');
      expect(deck.at(-1)?.level).toBe(3);
      expect(deck.every((s, i) => i === 0 || s.level >= deck[i - 1].level)).toBe(true);
    }
    expect(() => buildDeck('same-brain', 4)).toThrow('rounds');
  });
  it('deduplicates submissions and waits for both before starting the discussion', () => {
    const game = make('pick-my-poison');
    const a = choice(0, { prediction: 1 });
    const first = submitChoiceAnswer(game, 'player-0', a, 1000);
    expect(first.phase).toBe('answering');
    expect(first.discussionUntil).toBeNull();
    expect(submitChoiceAnswer(first, 'player-0', choice(1, { prediction: 0 }))).toBe(first);
    const both = submitChoiceAnswer(first, 'player-1', choice(1, { prediction: 0 }), 2000);
    expect(both.phase).toBe('discussion');
    expect(both.discussionUntil).toBe(32000);
    expect(() => readyForNext(both, 'player-0', 31999)).toThrow('discuss');
    const ready = readyForNext(both, 'player-0', 32000);
    expect(ready.phase).toBe('discussion');
    expect(readyForNext(ready, 'player-1', 32000).round).toBe(1);
  });
  it('scores Poison predictions against the OTHER player, not the predictor’s own choice', () => {
    const game = make('pick-my-poison');
    game.answers[0] = { 'player-0': choice(0, { prediction: 1 }), 'player-1': choice(1, { prediction: 0 }) };
    expect(scorePartyRound(game, 0)?.playerPoints).toEqual([1, 1]);
    game.answers[0] = { 'player-0': choice(0, { prediction: 1 }), 'player-1': choice(0, { prediction: 1 }) };
    expect(scorePartyRound(game, 0)?.playerPoints).toEqual([0, 0]);
  });
  it('alternates Read the Room responder/predictor roles and counts unequal opportunities fairly', () => {
    const game = make('read-the-room');
    game.answers = {
      0: { 'player-0': choice(2), 'player-1': choice(2) },
      1: { 'player-0': choice(1), 'player-1': choice(3) },
      2: { 'player-0': choice(0), 'player-1': choice(0) },
    };
    const result = partyRecap(game);
    expect(result.players.map(p => ({ points: p.points, attempts: p.attempts }))).toEqual([{ points: 0, attempts: 1 }, { points: 2, attempts: 2 }]);
    expect(result.rounds[1].notes[0]).toContain('Sam actually chose');
    expect(result.rounds[0].notes[2]).toContain('never marked right or wrong');
  });
  it('uses stable named-person options for More Likely, regardless of who is answering', () => {
    const game = make('more-likely');
    expect(optionLabels(game)).toEqual(['Mia', 'Sam']);
    game.answers[0] = { 'player-0': choice(0), 'player-1': choice(0) };
    expect(scorePartyRound(game, 0)?.sharedPoint).toBe(1);
    expect(scorePartyRound(game, 0)?.notes[0]).toContain('"Mia"');
    game.answers[0]['player-1'] = choice(1);
    expect(scorePartyRound(game, 0)?.sharedPoint).toBe(0);
    game.players[1].name = 'Mia';
    expect(optionLabels(game)).toEqual(['Mia (player 1)', 'Mia (player 2)']);
  });
  it('keeps Same Brain shared points separate from final match/no-match prediction bonuses', () => {
    const game = make('same-brain');
    game.answers = {
      0: { 'player-0': choice(0), 'player-1': choice(0) },
      1: { 'player-0': choice(1), 'player-1': choice(1) },
      2: { 'player-0': choice(0, { matchPrediction: false }), 'player-1': choice(1, { matchPrediction: true }) },
    };
    const result = partyRecap(game);
    expect(result.sharedPoints).toBe(2);
    expect(result.players.map(p => p.points)).toEqual([1, 0]);
    expect(result.players.map(p => p.attempts)).toEqual([1, 1]);
    expect(isBonusRound(game, 1)).toBe(false);
    expect(isBonusRound(game, 2)).toBe(true);
    expect(scorePartyRound(game, 2)?.notes).toContain('Mia predicted no match: 1 bonus point.');
  });
  it('requires all mode-specific predictions and rejects invalid indices, long text, and departed players', () => {
    const poison = make('pick-my-poison');
    expect(validChoiceAnswer(poison, choice(0))).toBe(false);
    expect(validChoiceAnswer(poison, choice(2, { prediction: 0 }))).toBe(false);
    expect(validChoiceAnswer(poison, choice(0, { prediction: 1.5 }))).toBe(false);
    expect(validChoiceAnswer(poison, choice(0, { prediction: 0, explanation: 'a'.repeat(601) }))).toBe(false);
    const brain = make('same-brain');
    brain.round = 2;
    expect(validChoiceAnswer(brain, choice(0))).toBe(false);
    expect(validChoiceAnswer(brain, choice(0, { matchPrediction: false }))).toBe(true);
    expect(() => submitChoiceAnswer(poison, 'stranger', choice(0, { prediction: 1 }))).toThrow('accepting');
    poison.players[1].left = true;
    expect(() => submitChoiceAnswer(poison, 'player-0', choice(0, { prediction: 1 }))).toThrow('accepting');
  });
  it('finishes all four games, restores exact scores after refresh, and exports reports without relationship grades', () => {
    for (const id of partyGameIds) {
      let game = make(id);
      for (let i = 0; i < 3; i++) {
        const a = choice(0, { ...(id === 'pick-my-poison' ? { prediction: 0 } : {}), ...(isBonusRound(game) ? { matchPrediction: true } : {}), explanation: 'An actual reason.' });
        game = submitChoiceAnswer(game, 'player-0', a, 0);
        game = submitChoiceAnswer(game, 'player-1', a, 0);
        game = readyForNext(game, 'player-0', 30000);
        game = readyForNext(game, 'player-1', 30000);
      }
      expect(game.phase).toBe('recap');
      expect(partyRecap(JSON.parse(JSON.stringify(game)))).toEqual(partyRecap(game));
      const text = partyReportText(game);
      expect(text).toContain('An actual reason.');
      expect(text).toContain('not relationship compatibility');
      expect(text).toContain('both players’ agreement');
      expect(text).not.toMatch(/\d+%/);
      expect(partyRecap(game).total).toBe(3);
    }
  });
  it('does not score or export an incomplete pair and keeps the demo independent of the human answer', () => {
    const game = make('pick-my-poison');
    game.answers[0] = { 'player-0': choice(0, { prediction: 1, explanation: 'Hidden incomplete answer.' }) };
    expect(scorePartyRound(game, 0)).toBeNull();
    const demo = demoChoiceAnswer(game);
    game.answers[0]['player-0'] = choice(1, { prediction: 0 });
    expect(demoChoiceAnswer(game)).toEqual(demo);
    expect(() => partyReportText(game)).toThrow('Finish');
    game.phase = 'recap';
    expect(partyReportText(game)).not.toContain('Hidden incomplete answer.');
  });
});
