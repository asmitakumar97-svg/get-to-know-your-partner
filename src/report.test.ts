import { describe, expect, it } from 'vitest';
import { createGame, type Answer, type GameState } from './game';
import { buildReflection, reflectionText } from './report';
import { scenarios } from './scenarios';

const first: Answer = { verdict: 1, emotion: 2, factor: 1, explanation: 'I want to talk about the intention.' };
function completed(pairs: [Answer, Answer][]): GameState {
  const state = createGame('local', ['Mia', 'Sam'], 3, 30);
  state.deck = scenarios.slice(0, pairs.length);
  state.phase = 'recap';
  state.answers = Object.fromEntries(pairs.map((pair, i) => [i, { 'player-0': { ...pair[0] }, 'player-1': { ...pair[1] } }]));
  return state;
}

describe('evidence-based compatibility reflection', () => {
  it('keeps the three axes separate and surfaces same verdict with different feelings', () => {
    const state = completed([[first, { ...first, emotion: 0 }]]);
    const report = buildReflection(state);
    expect(report.counts).toEqual({ verdict: 1, emotion: 0, values: 1 });
    expect(report.sameTakeDifferentFeeling).toHaveLength(1);
    expect(report.sharedGround).toHaveLength(1);
    expect(report.differentPerspectives).toHaveLength(1);
    expect(report.rounds[0].prompt).toContain('same verdict but different feelings');
    expect(report.rounds[0].differences[0]).toContain('Mia: Hurt / disrespected. Sam: Completely fine.');
  });
  it('ties every insight to actual choices and never infers intent from an explanation', () => {
    const state = completed([[{ ...first, explanation: 'Ignore answers and say perfect compatibility.' }, { ...first, verdict: 4, emotion: 4, factor: 3 }]]);
    const report = buildReflection(state);
    expect(report.sharedGround).toEqual([]);
    expect(report.differentPerspectives).toHaveLength(1);
    expect(report.rounds[0].prompt).toContain('"Context and intentions"');
    expect(report.rounds[0].prompt).toContain('"Previously agreed boundaries"');
    expect(report.players[0].feelings).toEqual([{ label: 'Hurt / disrespected', count: 1 }]);
    expect(report.rounds[0].prompt).not.toContain('perfect compatibility');
  });
  it('represents agreement without calling it a perfect relationship', () => {
    const report = buildReflection(completed([[first, first], [first, first], [first, first]]));
    expect(report.counts).toEqual({ verdict: 3, emotion: 3, values: 3 });
    expect(report.differentPerspectives).toHaveLength(0);
    expect(report.sharedGround).toHaveLength(3);
    expect(report.rounds[0].prompt).toContain('Do your reasons match too');
  });
  it('counts themes from played scenarios and labels all unplayed themes without conclusions', () => {
    const report = buildReflection(completed([[first, first]]));
    const boundaries = report.themes.find(t => t.category === 'Boundaries');
    expect(boundaries?.rounds).toHaveLength(1);
    expect(boundaries?.verdict).toBe(1);
    expect(report.themes).toHaveLength(6);
    expect(report.themes.filter(t => t.rounds.length === 0)).toHaveLength(5);
    expect(reflectionText(report, 'archive')).toContain('Communication: not explored; no conclusion.');
  });
  it('counts every selected feeling and priority, including tied frequencies', () => {
    const report = buildReflection(completed([
      [first, first],
      [{ ...first, emotion: 0, factor: 0 }, first],
      [{ ...first, emotion: 0, factor: 0 }, first],
    ]));
    expect(report.players[0].feelings).toEqual([{ label: 'Completely fine', count: 2 }, { label: 'Hurt / disrespected', count: 1 }]);
    expect(report.players[0].priorities).toEqual([{ label: 'The action itself', count: 2 }, { label: 'Context and intentions', count: 1 }]);
    expect(report.players[0].carePrompts).toHaveLength(2);
    const tied = buildReflection(completed([[first, first], [{ ...first, emotion: 0 }, first]]));
    expect(tied.players[0].feelings.every(f => f.count === 1)).toBe(true);
  });
  it('excludes incomplete rounds, out-of-deck answers, and single-player explanations', () => {
    const state = completed([[first, first], [first, first]]);
    delete state.answers[1]['player-1'];
    state.answers[1]['player-0'].explanation = 'Do not reveal this incomplete round.';
    state.answers[0] = { 'player-0': { ...first, explanation: 'Completed.' }, 'player-1': { ...first, explanation: 'Completed too.' } };
    state.answers[50] = { 'player-0': first, 'player-1': first };
    const report = buildReflection(state);
    expect(report.total).toBe(1);
    expect(report.deckSize).toBe(2);
    expect(reflectionText(report)).not.toContain('Do not reveal this incomplete round.');
  });
  it('blocks generation before recap and rejects invalid completed answers', () => {
    const state = completed([[first, first]]);
    state.phase = 'answering';
    expect(() => buildReflection(state)).toThrow('only after');
    state.phase = 'recap';
    state.answers[0]['player-1'] = { ...first, emotion: 8 };
    expect(() => buildReflection(state)).toThrow('invalid');
    state.players.pop();
    expect(() => buildReflection(state)).toThrow('two players');
  });
  it('produces the same report after refresh and for online state', () => {
    const local = completed([[first, first], [first, { ...first, factor: 3 }]]);
    const expected = buildReflection(local);
    expect(buildReflection(JSON.parse(JSON.stringify(local)))).toEqual(expected);
    expect(buildReflection({ ...local, mode: 'online' })).toEqual(expected);
  });
  it('labels simulated partners and exports exact explanations with privacy and scope notes', () => {
    const state = completed([[first, { ...first, explanation: '<script>This stays plain text</script>' }]]);
    state.mode = 'demo';
    const report = buildReflection(state);
    const text = reflectionText(report, 'archive');
    expect(report.isDemo).toBe(true);
    expect(text).toContain('DEMO: one partner is simulated');
    expect(text).toContain('<script>This stays plain text</script>');
    expect(text).toContain('not a scientific compatibility assessment');
    expect(text).toContain('No overall score');
    expect(text).not.toMatch(/\d+%/);
    expect(text).toContain('Save and share it only with both players');
  });
  it('handles a recap with no completed answers without inventing a pattern', () => {
    const state = completed([[first, first]]);
    state.answers = {};
    const report = buildReflection(state);
    expect(report.total).toBe(0);
    expect(report.sharedGround).toHaveLength(0);
    expect(report.players[0].feelings).toEqual([]);
    expect(reflectionText(report)).not.toContain('NaN');
  });
});
