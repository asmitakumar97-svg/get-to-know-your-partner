import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { games } from './catalog';
import { createGame, isChoiceGame, readyForNext, submitAnswer, type SessionState } from './game';
import { createNight, advanceNight, nightReportText } from './night';
import { createChoiceGame, demoChoiceAnswer, partyReportText, submitChoiceAnswer } from './party';
import { empathyQuestions } from './relationshipGames';
import { reflectionText, buildReflection } from './report';
import { canSwitchQuestion, chooseReplacement, replacementQuestions, switchQuestion } from './questionSwitching';
import { SwitchQuestion } from './SwitchQuestion';

const questionGames = games.filter(game => game.id !== 'us-against-the-world');
const noOp = async () => {};
function submit(game: SessionState, id: string) {
  return isChoiceGame(game) ? submitChoiceAnswer(game, id, demoChoiceAnswer(game), 0)
    : submitAnswer(game, id, { verdict: 0, emotion: 0, factor: 0, explanation: '' }, 0);
}
function finish(game: SessionState) {
  let next = game;
  while (next.phase === 'answering') {
    for (const player of next.players) next = submit(next, player.id);
    next = readyForNext(readyForNext(next, next.players[0].id), next.players[1].id);
  }
  return next;
}

describe('Switching a question before either submission', () => {
  it.each(questionGames)('switches $title in local/demo mode, persists history and excludes the old question from reports', definition => {
    for (const mode of ['local', 'demo'] as const) {
      const original = definition.id === 'same-page' ? createGame(mode, ['Mia', 'Sam'], 3, 30)
        : createChoiceGame(definition.id, mode, ['Mia', 'Sam'], 3, 30);
      const old = original.deck[0];
      const next = switchQuestion(original, original.players[0].id);
      expect(next.id).toBe(original.id);
      expect(next.round).toBe(0);
      expect(next.phase).toBe('answering');
      expect(next.deck).toHaveLength(original.deck.length);
      expect(next.deck[0].id).not.toBe(old.id);
      expect(next.deck.slice(1)).toEqual(original.deck.slice(1));
      expect(original.switchedQuestions).toBeUndefined();
      expect(next.switchedQuestions).toEqual([{ id: old.id, text: old.text }]);
      const restored: SessionState = JSON.parse(JSON.stringify(next));
      expect(replacementQuestions(restored).some(question => question.id === old.id)).toBe(false);
      const completed = finish(restored);
      const archive = isChoiceGame(completed) ? partyReportText(completed, 'archive') : reflectionText(buildReflection(completed), 'archive');
      expect(archive).toContain(next.deck[0].text);
      expect(archive).not.toContain(old.text);
    }
  });
  it('allows more than three switches and never repeats a deck or set-aside question before exhaustion', () => {
    let game: SessionState = createGame('local', ['Mia', 'Sam'], 3, 30);
    const available = replacementQuestions(game).length;
    const seen = new Set(game.deck.map(question => question.id));
    for (let index = 0; index < available; index++) {
      game = switchQuestion(game, game.players[0].id);
      expect(seen.has(game.deck[0].id)).toBe(false);
      seen.add(game.deck[0].id);
    }
    expect(available).toBeGreaterThan(3);
    expect(game.switchedQuestions).toHaveLength(available);
    expect(replacementQuestions(game)).toHaveLength(0);
    expect(() => switchQuestion(game, game.players[0].id)).toThrow('No unused alternatives');
    const markup = renderToStaticMarkup(<SwitchQuestion game={game} busy={false} onSwitch={noOp} />);
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('No unused alternatives');
  });
  it('preserves chosen categories, legacy sections, verdict/reason wording and dilemma difficulty', () => {
    const empathy = createChoiceGame('if-i-were-you', 'local', ['Mia', 'Sam'], 3, 30, empathyQuestions.slice(0, 3));
    expect(replacementQuestions(empathy).every(question => question.category === empathy.deck[0].category)).toBe(true);
    const legacy = createGame('local', ['Mia', 'Sam'], 5, 30, ['Trust']);
    expect(chooseReplacement(legacy).category).toBe('Trust');
    const page = createGame('local', ['Mia', 'Sam'], 3, 30);
    expect(chooseReplacement(page).verdictOptions).toEqual(page.deck[0].verdictOptions);
    expect(chooseReplacement(page).reasonOptions).toEqual(page.deck[0].reasonOptions);
    const poison = createChoiceGame('pick-my-poison', 'local', ['Mia', 'Sam'], 3, 30);
    expect(replacementQuestions(poison).every(question => question.level === poison.deck[0].level)).toBe(true);
  });
  it('does not offer switching after a submission, on reveals, after departures, or in adventures', () => {
    const game = createChoiceGame('if-i-were-you', 'local', ['Mia', 'Sam'], 3, 30);
    const first = submit(game, game.players[0].id);
    const revealed = submit(first, first.players[1].id);
    const departed = { ...game, players: game.players.map(player => ({ ...player, left: true })) };
    const adventure = createChoiceGame('us-against-the-world', 'local', ['Mia', 'Sam'], 5, 30);
    for (const blocked of [first, revealed, departed, adventure]) {
      expect(canSwitchQuestion(blocked)).toBe(false);
      expect(renderToStaticMarkup(<SwitchQuestion game={blocked} busy={false} onSwitch={noOp} />)).toBe('');
      expect(() => switchQuestion(blocked, blocked.players[0].id)).toThrow('before either');
    }
    expect(() => switchQuestion(game, 'outsider')).toThrow('before either');
    expect(() => switchQuestion({ ...game, mode: 'online' }, game.players[0].id)).toThrow('room server');
    expect(renderToStaticMarkup(<SwitchQuestion game={game} busy onSwitch={noOp} />)).toContain('disabled=""');
  });
  it('keeps the active playlist snapshot, completed archive and combined report consistent', () => {
    let game = createNight('local', ['Mia', 'Sam'], ['if-i-were-you', 'same-brain'], 3, 30);
    const original = game.deck[0];
    game = switchQuestion(game, game.players[0].id);
    expect(game.night?.playlist[0].deck).toEqual(game.deck);
    for (let index = 0; index < 2; index++) {
      game = finish(game);
      game = advanceNight(advanceNight(game, game.players[0].id, index), game.players[1].id, index);
    }
    expect(game.night?.completed[0].switchedQuestions?.[0].id).toBe(original.id);
    expect(nightReportText(game, 'archive')).not.toContain(original.text);
  });
});
