import { describe, expect, it } from 'vitest';
import { alignment, createGame, readyForNext, recap, submitAnswer, validAnswer, type Answer } from './game';
import { buildSectionDeck, scenarios, sections, selectedSectionsFromDeck } from './scenarios';
import { partyDecks } from './catalog';
import { samePageLibrary } from './samePageLibrary';
const answer: Answer = { verdict: 1, emotion: 2, factor: 3, explanation: 'Let’s talk.' };

describe('Same Page game rules', () => {
  it('ships five unique editable scenarios for each of the six sections', () => {
    expect(scenarios).toHaveLength(30);
    expect(new Set(scenarios.map(s => s.id)).size).toBe(30);
    expect(new Set(scenarios.map(s => s.category)).size).toBe(6);
    for (const section of sections) expect(scenarios.filter(s => s.category === section)).toHaveLength(5);
    expect(scenarios[0].text).toBe('Your partner buys flowers for someone else and says they were just being nice.');
  });
  it('uses gender-neutral scenarios and prompts across all eight games', () => {
    const all = [...scenarios, ...Object.values(partyDecks).flat()];
    expect(all).toHaveLength(175);
    for (const scenario of all) expect(`${scenario.title} ${scenario.text} ${scenario.prompt}`)
      .not.toMatch(/\b(boyfriend|girlfriend|girl|boy|woman|man|women|men|husband|wife|he|she|his|her)\b/i);
  });
  it('builds ordered five-question sections for every supported selection size', () => {
    for (let length = 1; length <= sections.length; length++) {
      const selected = sections.slice(0, length);
      const game = createGame('local', ['Mia', 'Sam'], 3, 30, selected);
      expect(game.deck).toHaveLength(length * 5);
      selected.forEach((section, i) => expect(game.deck.slice(i * 5, i * 5 + 5).every(scenario => scenario.category === section)).toBe(true));
      expect(selectedSectionsFromDeck(game.deck)).toEqual(selected);
    }
    expect(() => buildSectionDeck([])).toThrow('Choose');
    expect(() => buildSectionDeck(['Trust', 'Trust'])).toThrow('different');
    expect(selectedSectionsFromDeck(scenarios.slice(0, 3))).toBeUndefined();
    expect(selectedSectionsFromDeck([])).toBeUndefined();
  });
  it('creates a mixed distinct deck from the curated library without a fixed opening question', () => {
    const state = createGame('local', ['A', 'B'], 10, 60);
    expect(state.deck).toHaveLength(10);
    expect(state.deck.every(question => samePageLibrary.includes(question))).toBe(true);
    expect(new Set(state.deck.map(s => s.id)).size).toBe(10);
  });
  it('waits for two submissions, deduplicates, and starts a discussion timer', () => {
    const state = createGame('local', ['A', 'B'], 3, 60);
    const first = submitAnswer(state, 'player-0', answer, 1000);
    expect(first.phase).toBe('answering');
    expect(first.discussionUntil).toBeNull();
    expect(submitAnswer(first, 'player-0', { ...answer, verdict: 4 })).toBe(first);
    const both = submitAnswer(first, 'player-1', answer, 2000);
    expect(both.phase).toBe('discussion');
    expect(both.discussionUntil).toBe(62000);
    const ready = readyForNext(both, 'player-0', 2001);
    expect(ready.phase).toBe('discussion');
    expect(readyForNext(ready, 'player-0', 2001).ready).toHaveLength(1);
    expect(readyForNext(ready, 'player-1', 2001).round).toBe(1);
  });
  it('keeps emotional, verdict, and values alignment independent', () => {
    expect(alignment(answer, { ...answer, verdict: 4 })).toEqual({ verdict: false, emotion: true, values: true });
    expect(alignment(answer, { ...answer, emotion: 0, factor: 0 })).toEqual({ verdict: true, emotion: false, values: false });
  });
  it('finishes, preserves round answers through serialization, and reports exact match counts', () => {
    let state = createGame('local', ['A', 'B'], 3, 30);
    for (let i = 0; i < 3; i++) {
      state = submitAnswer(state, 'player-0', answer, 0);
      state = submitAnswer(state, 'player-1', { ...answer, emotion: 0 }, 0);
      state = readyForNext(state, 'player-0', 30000);
      state = readyForNext(state, 'player-1', 30000);
    }
    expect(state.phase).toBe('recap');
    expect(recap(JSON.parse(JSON.stringify(state)))).toEqual({ total: 3, verdict: 3, emotion: 0, values: 3 });
  });
  it('rejects incomplete, oversized, invalid, and departed-player answers', () => {
    expect(validAnswer({ ...answer, verdict: -1 })).toBe(false);
    expect(validAnswer({ ...answer, emotion: 5 })).toBe(false);
    expect(validAnswer({ ...answer, factor: 1.5 })).toBe(false);
    expect(validAnswer({ ...answer, explanation: 'a'.repeat(601) })).toBe(false);
    const state = createGame('local', ['A', 'B'], 3, 30);
    expect(() => submitAnswer(state, 'intruder', answer)).toThrow();
    state.players[0].left = true;
    expect(() => submitAnswer(state, 'player-0', answer)).toThrow();
  });
});
