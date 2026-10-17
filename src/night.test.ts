import { describe, expect, it } from 'vitest';
import { games } from './catalog';
import { isChoiceGame, readyForNext, submitAnswer, type SessionState } from './game';
import { submitChoiceAnswer } from './party';
import { advanceNight, buildPlaylist, createNight, nightReflection, nightReportText } from './night';

function completeGame(game: SessionState): SessionState {
  let next = game;
  while (next.phase === 'answering') {
    if (isChoiceGame(next)) {
      for (const player of next.players) next = submitChoiceAnswer(next, player.id, {
        choice: 0, prediction: 0, matchPrediction: true, explanation: 'A private game-night thought.',
      });
    } else {
      for (const [i, player] of next.players.entries()) next = submitAnswer(next, player.id, {
        verdict: 0, emotion: i, factor: i, explanation: 'My boundary and my context.',
      });
    }
    const deadline = next.discussionUntil ?? 0;
    next = readyForNext(next, next.players[0].id, deadline);
    next = readyForNext(next, next.players[1].id, deadline);
  }
  return next;
}

function finishNight(game: SessionState): SessionState {
  let next = game;
  while (!next.night?.finished) {
    next = completeGame(next);
    const index = next.night?.index ?? -1;
    next = advanceNight(next, next.players[0].id, index);
    next = advanceNight(next, next.players[1].id, index);
  }
  return next;
}

describe('two-person game-night playlists', () => {
  it('validates selection, round counts, names, and discussion time', () => {
    expect(() => buildPlaylist(['same-page'], 3)).toThrow('two to five');
    expect(() => buildPlaylist(['same-brain', 'same-brain'], 3)).toThrow('different');
    expect(() => buildPlaylist(['same-brain', 'same-page'], 4)).toThrow('rounds');
    expect(() => createNight('local', ['Mia', ''], ['same-page', 'same-brain'], 3, 30)).toThrow('name');
    expect(() => createNight('local', ['Mia', 'Sam'], ['same-page', 'same-brain'], 3, 0)).toThrow('discussion');
  });
  it('preserves the exact chosen game order, including Same Page as an equal playlist game', () => {
    const game = createNight('local', ['Mia', 'Sam'], ['more-likely', 'same-page', 'pick-my-poison'], 3, 60);
    expect(game.gameType).toBe('more-likely');
    expect(game.night?.playlist.map(entry => entry.gameType)).toEqual(['more-likely', 'same-page', 'pick-my-poison']);
    expect(game.night?.playlist.every(entry => entry.deck.length === 3)).toBe(true);
    expect(() => nightReflection(game)).toThrow('Finish');
  });
  it('keeps Same Page section counts independent of the other games and in the final report', () => {
    const game = createNight('local', ['Mia', 'Sam'], ['same-brain', 'same-page'], 3, 30, ['Trust', 'Respect', 'Communication']);
    expect(game.night?.playlist.map(entry => entry.deck.length)).toEqual([3, 15]);
    const done = finishNight(game);
    expect(nightReflection(done).total).toBe(18);
    expect(nightReflection(done).summaries[1].total).toBe(15);
    expect(done.deck.filter(scenario => scenario.category === 'Trust')).toHaveLength(5);
    expect(done.deck.filter(scenario => scenario.category === 'Boundaries')).toHaveLength(0);
  });
  it('requires a finished game and both players, then advances exactly once', () => {
    const game = createNight('local', ['Mia', 'Sam'], ['same-page', 'same-brain'], 3, 30);
    expect(() => advanceNight(game, 'player-0', 0)).toThrow('Finish');
    const completed = completeGame(game);
    const first = advanceNight(completed, 'player-0', 0);
    expect(first.night?.index).toBe(0);
    expect(first.ready).toEqual(['player-0']);
    expect(advanceNight(first, 'player-0', 0).night?.completed).toHaveLength(0);
    const next = advanceNight(first, 'player-1', 0);
    expect(next.gameType).toBe('same-brain');
    expect(next.night?.completed).toHaveLength(1);
    expect(next.night?.completed[0].night).toBeUndefined();
    expect(next.answers).toEqual({});
    expect(next.round).toBe(0);
    expect(next.players).toEqual(game.players);
    expect(advanceNight(next, 'player-1', 0)).toBe(next);
    expect(() => advanceNight(next, 'stranger', 1)).toThrow('Both players');
    expect(() => advanceNight({ ...next, mode: 'online' }, 'player-0', 1)).toThrow('server');
  });
  it('restores a partial playlist, then produces five separate evidence-based reflections', () => {
    const original = createNight('local', ['Mia', 'Sam'], games.map(game => game.id), 3, 30);
    let next = completeGame(original);
    next = advanceNight(advanceNight(next, 'player-0', 0), 'player-1', 0);
    const restored: SessionState = JSON.parse(JSON.stringify(next));
    expect(restored.night?.completed[0].answers).toEqual(next.night?.completed[0].answers);
    const completed = finishNight(restored);
    const result = nightReflection(completed);
    expect(result.summaries).toHaveLength(5);
    expect(result.total).toBe(15);
    expect(result.summaries[0].lines).toEqual(['Verdict: 3 of 3 shared choices.', 'Emotion: 0 of 3 shared choices.', 'Main factor: 0 of 3 shared choices.']);
    expect(result.summaries[1].lines).toContain('Shared choices: 3 of 3 rounds.');
    expect(result.summaries[1].lines).toContain('Mia: 1 of 1 match-prediction bonuses.');
    expect(result.summaries[3].lines).toEqual(['Mia: 1 of 1 accurate predictions.', 'Sam: 2 of 2 accurate predictions.']);
    expect(result.summaries[0].discoveries[0]).toContain('Mia');
    expect(result.summaries[0].discoveries[0]).toContain('Sam');
    expect(advanceNight(completed, 'player-0', 4)).toBe(completed);
    const text = nightReportText(completed);
    expect(text).toContain('5 games, 15 completed rounds.');
    expect(text).toContain('A private game-night thought.');
    expect(text).toContain('My boundary and my context.');
    expect(text).toContain('not a relationship grade');
    expect(text).not.toContain('%');
    expect(nightReportText(JSON.parse(JSON.stringify(completed)))).toBe(text);
  });
  it('rejects damaged completed evidence instead of manufacturing a successful report', () => {
    const done = finishNight(createNight('local', ['Mia', 'Sam'], ['same-page', 'same-brain'], 3, 30));
    if (!done.night) throw new Error('Missing night fixture.');
    delete done.night.completed[0].answers[0];
    expect(() => nightReflection(done)).toThrow('missing paired answers');
  });
  it('keeps simulated reports explicitly separate from real relationships', () => {
    const done = finishNight(createNight('demo', ['You', 'Alex (demo)'], ['same-brain', 'read-the-room'], 3, 30));
    expect(nightReportText(done)).toContain('DEMO: one partner is simulated.');
  });
});
