import { describe, expect, it } from 'vitest';
import { buildDeck, partyDecks, partyGameIds, type PartyGameId } from './catalog';
import { readyForNext, type ChoiceAnswer } from './game';
import { createChoiceGame, demoChoiceAnswer, isMatchPredictionRound, optionLabels, partyRecap, partyReportText, comparePartyRound, submitChoiceAnswer, validChoiceAnswer } from './party';

const choice = (n: number, extra: Partial<ChoiceAnswer> = {}): ChoiceAnswer => ({ choice: n, explanation: '', ...extra });
const make = (id: PartyGameId) => createChoiceGame(id, 'local', ['Mia', 'Sam'], 3, 30);

describe('four distinct game mechanics', () => {
  it('seeds 20 unique editable questions per game with valid answer options', () => {
    for (const id of partyGameIds) {
      const deck = partyDecks[id];
      expect(deck).toHaveLength(20);
      expect(new Set(deck.map(s => s.id)).size).toBe(20);
      expect(deck.every(s => s.text && s.title && s.prompt)).toBe(true);
      expect(deck.every(s => s.options.length === (id === 'same-brain' || id === 'read-the-room' ? 4 : id === 'more-likely' ? 3 : 2))).toBe(true);
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
    const ready = readyForNext(both, 'player-0', 2001);
    expect(ready.phase).toBe('discussion');
    expect(readyForNext(ready, 'player-1', 2001).round).toBe(1);
  });
  it('compares Poison predictions with the OTHER player, not the predictor’s own choice', () => {
    const game = make('pick-my-poison');
    game.answers[0] = { 'player-0': choice(0, { prediction: 1 }), 'player-1': choice(1, { prediction: 0 }) };
    expect(comparePartyRound(game, 0)?.predictionMatches).toEqual([true, true]);
    game.answers[0] = { 'player-0': choice(0, { prediction: 1 }), 'player-1': choice(0, { prediction: 1 }) };
    expect(comparePartyRound(game, 0)?.predictionMatches).toEqual([false, false]);
  });
  it('alternates Read the Room responder/predictor roles and counts unequal opportunities fairly', () => {
    const game = make('read-the-room');
    game.answers = {
      0: { 'player-0': choice(2), 'player-1': choice(2) },
      1: { 'player-0': choice(1), 'player-1': choice(3) },
      2: { 'player-0': choice(0), 'player-1': choice(0) },
    };
    const result = partyRecap(game);
    expect(result.players.map(p => ({ matched: p.matchingPredictions, responses: p.predictionCount }))).toEqual([{ matched: 0, responses: 1 }, { matched: 2, responses: 2 }]);
    expect(result.rounds[1].notes[0]).toContain('Sam actually chose');
    expect(result.rounds[0].notes[2]).toContain('never marked right or wrong');
  });
  it('uses stable named-person options for More Likely, regardless of who is answering', () => {
    const game = make('more-likely');
    expect(optionLabels(game)).toEqual(['Mia', 'Sam', 'Both of us']);
    game.answers[0] = { 'player-0': choice(0), 'player-1': choice(0) };
    expect(comparePartyRound(game, 0)?.matched).toBe(true);
    expect(comparePartyRound(game, 0)?.notes[0]).toContain('"Mia"');
    game.answers[0]['player-1'] = choice(1);
    expect(comparePartyRound(game, 0)?.matched).toBe(false);
    game.players[1].name = 'Mia';
    expect(optionLabels(game)).toEqual(['Mia (player 1)', 'Mia (player 2)', 'Both of us']);
  });
  it('compares Both of us and preserves legacy two-option saved decks', () => {
    const game = make('more-likely');
    game.deck = game.deck.map(question => ({ ...question, options: question.options.slice(0, 2) }));
    expect(validChoiceAnswer(game, choice(2))).toBe(true);
    game.answers[0] = { 'player-0': choice(2), 'player-1': choice(2) };
    expect(comparePartyRound(game, 0)?.matched).toBe(true);
    expect(comparePartyRound(game, 0)?.notes[0]).toContain('Both of us');
    game.phase = 'recap';
    expect(partyReportText(game, 'archive')).toContain('Both of us');
    game.answers[0]['player-1'] = choice(1);
    expect(comparePartyRound(game, 0)?.matched).toBe(false);
    expect(validChoiceAnswer(game, choice(3))).toBe(false);
  });
  it('builds complete 30- and 50-question decks for every party game', () => {
    for (const kind of partyGameIds) for (const count of [30, 50]) {
      const game = createChoiceGame(kind, 'local', ['A', 'B'], count, 30);
      expect(game.deck).toHaveLength(count);
      expect(new Set(game.deck.map(question => question.text)).size).toBe(count);
      if (kind === 'pick-my-poison') expect(game.deck.every((question, i) => !i || question.level >= game.deck[i - 1].level)).toBe(true);
      if (kind === 'same-brain') expect(isMatchPredictionRound({ ...game, round: count - 1 })).toBe(true);
    }
  });
  it('compares Same Brain preferences and final expectations without awarding points', () => {
    const game = make('same-brain');
    game.answers = {
      0: { 'player-0': choice(0), 'player-1': choice(0) },
      1: { 'player-0': choice(1), 'player-1': choice(1) },
      2: { 'player-0': choice(0, { matchPrediction: false }), 'player-1': choice(1, { matchPrediction: true }) },
    };
    const result = partyRecap(game);
    expect(result.rounds.filter(r => r.matched)).toHaveLength(2);
    expect(result.rounds[2].predictionMatches).toEqual([true, false]);
    expect(result).not.toHaveProperty('sharedPoints');
    expect(result.rounds[2]).not.toHaveProperty('playerPoints');
    expect(result.players.every(player => !('points' in player))).toBe(true);
    expect(isMatchPredictionRound(game, 1)).toBe(false);
    expect(isMatchPredictionRound(game, 2)).toBe(true);
    expect(comparePartyRound(game, 2)?.notes).toContain('Mia expected different choices.');
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
  it('finishes all four games, restores exact comparisons after refresh, and exports score-free reports', () => {
    for (const id of partyGameIds) {
      let game = make(id);
      for (let i = 0; i < 3; i++) {
        const a = choice(0, { ...(id === 'pick-my-poison' ? { prediction: 0 } : {}), ...(isMatchPredictionRound(game) ? { matchPrediction: true } : {}), explanation: 'An actual reason.' });
        game = submitChoiceAnswer(game, 'player-0', a, 0);
        game = submitChoiceAnswer(game, 'player-1', a, 0);
        game = readyForNext(game, 'player-0', 30000);
        game = readyForNext(game, 'player-1', 30000);
      }
      expect(game.phase).toBe('recap');
      expect(partyRecap(JSON.parse(JSON.stringify(game)))).toEqual(partyRecap(game));
      const text = partyReportText(game, 'archive');
      expect(text).toContain('An actual reason.');
      expect(text).toContain('not relationship compatibility');
      expect(text).toContain('both players’ agreement');
      expect(text).not.toMatch(/\d+%|shared points?|bonus|prediction points?|\d+\s+points?/i);
      expect(partyRecap(game).total).toBe(3);
    }
  });
  it('does not compare or export an incomplete pair and keeps the demo independent of the human answer', () => {
    const game = make('pick-my-poison');
    game.answers[0] = { 'player-0': choice(0, { prediction: 1, explanation: 'Hidden incomplete answer.' }) };
    expect(comparePartyRound(game, 0)).toBeNull();
    const demo = demoChoiceAnswer(game);
    game.answers[0]['player-0'] = choice(1, { prediction: 0 });
    expect(demoChoiceAnswer(game)).toEqual(demo);
    expect(() => partyReportText(game)).toThrow('Finish');
    game.phase = 'recap';
    expect(partyReportText(game)).not.toContain('Hidden incomplete answer.');
  });
});
