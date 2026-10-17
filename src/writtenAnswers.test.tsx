import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { games } from './catalog';
import { alignment, createGame, isChoiceGame, readyForNext, submitAnswer, validAnswer, type Answer, type ChoiceAnswer, type SessionState } from './game';
import { createChoiceGame, demoChoiceAnswer, partyRecap, partyReportText, submitChoiceAnswer, validChoiceAnswer } from './party';
import { buildReflection, reflectionText } from './report';
import { analyzeParty, analyzeSamePage, combineAnalyses, selectReportInsights } from './insights';
import { analyzeRelationshipGame } from './relationshipInsights';
import { PartyGame, PartyReport } from './PartyGame';
import { CompatibilityReport } from './CompatibilityReport';
import { AnswerChoices } from './AnswerChoices';
import { OtherAnswer } from './OtherAnswer';
import { compareResponses, OTHER_ANSWER, responseLabel, validResponse } from './writtenAnswers';
import { advanceNight, createNight, nightReflection, nightReportText } from './night';

const questionGames = games.filter(game => game.id !== 'us-against-the-world');
const noOp = async () => {};
const writtenPage: Answer = { verdict: OTHER_ANSWER, emotion: OTHER_ANSWER, factor: OTHER_ANSWER, customVerdict: 'I would ask for more information.', customEmotion: 'Surprised, but not upset.', customFactor: 'What we have each understood.', explanation: '' };
function writtenChoice(game: ReturnType<typeof createChoiceGame>): ChoiceAnswer {
  return { ...demoChoiceAnswer(game), choice: OTHER_ANSWER, customChoice: 'A different kind of answer.', ...(['pick-my-poison', 'if-i-were-you'].includes(game.gameType) ? { prediction: OTHER_ANSWER, customPrediction: 'Maybe a little time together first.' } : {}) };
}
function finish(game: SessionState): SessionState {
  let next = game;
  while (next.phase === 'answering') {
    for (const player of next.players) next = isChoiceGame(next)
      ? submitChoiceAnswer(next, player.id, writtenChoice(next))
      : submitAnswer(next, player.id, writtenPage);
    next = JSON.parse(JSON.stringify(next));
    next = readyForNext(readyForNext(next, next.players[0].id), next.players[1].id);
  }
  return next;
}

describe('Written response validation and neutral comparison', () => {
  it('distinguishes Other from unselected and validates exact length, whitespace and option bounds', () => {
    for (const text of [undefined, '', ' \n\t', '\u00a0\ufeff', 'x'.repeat(601), '😀'.repeat(301)]) expect(validResponse(OTHER_ANSWER, text, 5)).toBe(false);
    for (const text of ['A response', 'x'.repeat(600), '😀'.repeat(300)]) expect(validResponse(OTHER_ANSWER, text, 5)).toBe(true);
    expect(validResponse(-1, 'Written', 5)).toBe(false);
    expect(validResponse(0, 'Stale hidden text', 5)).toBe(false);
    expect(validResponse(5, undefined, 5)).toBe(false);
    expect(validResponse(0, undefined, 5)).toBe(true);
    expect(compareResponses(OTHER_ANSWER, OTHER_ANSWER)).toBeNull();
    expect(compareResponses(OTHER_ANSWER, 0)).toBeNull();
    expect(compareResponses(0, 1)).toBe(false);
    expect(() => responseLabel(['Yes'], OTHER_ANSWER)).toThrow('invalid');
  });
  it('keeps Same Page axes independent and requires each written field separately', () => {
    expect(validAnswer(writtenPage)).toBe(true);
    expect(validAnswer({ ...writtenPage, customEmotion: '' })).toBe(false);
    expect(alignment({ ...writtenPage, emotion: 0, customEmotion: undefined, factor: 0, customFactor: undefined }, { verdict: 0, emotion: 0, factor: 1, explanation: '' }))
      .toEqual({ verdict: null, emotion: true, values: false });
  });
  it('does not enable Other for adventure actions or boolean match forecasts', () => {
    const adventure = createChoiceGame('us-against-the-world', 'demo', ['Mia', 'Sam'], 5, 30);
    expect(validChoiceAnswer(adventure, { choice: OTHER_ANSWER, customChoice: 'Invent an action', explanation: '' })).toBe(false);
    const markup = renderToStaticMarkup(<AnswerChoices title="Your take" options={['Yes']} name="take" selected={0} onChange={() => {}} />);
    expect(markup).not.toContain('Other');
  });
  it('renders a required, labelled and length-limited field only when Other is selected', () => {
    const markup = renderToStaticMarkup(<OtherAnswer name="own" selected={OTHER_ANSWER} value="Own words" onSelect={() => {}} onChange={() => {}} />);
    expect(markup).toContain('Other — write your answer');
    expect(markup).toContain('name="own-written"');
    expect(markup).toContain('maxLength="600"');
    expect(markup).toContain('required=""');
    expect(renderToStaticMarkup(<OtherAnswer name="own" selected={0} value="Hidden draft" onSelect={() => {}} onChange={() => {}} />)).not.toContain('<textarea');
  });
});

describe('Written answers across all seven conversation games', () => {
  it.each(questionGames)('completes $title locally and in demo with refresh, literal journals and unassessed answers', definition => {
    for (const mode of ['local', 'demo'] as const) {
      const initial = definition.id === 'same-page' ? createGame(mode, ['Mia', 'Sam'], 3, 30) : createChoiceGame(definition.id, mode, ['Mia', 'Sam'], 3, 30);
      const completed = finish(initial);
      expect(completed.phase).toBe('recap');
      if (isChoiceGame(completed)) {
        const recap = partyRecap(completed);
        expect(recap.rounds).toHaveLength(3);
        expect(recap.rounds.every(round => round.matched === null)).toBe(true);
        expect(recap.rounds.every(round => new Set(round.notes).size === round.notes.length)).toBe(true);
        expect(recap.players.every(player => player.predictionCount === 0)).toBe(true);
        const analysis = analyzeParty(completed, recap, completed.deck.map(scene => scene.options));
        expect(analysis.headline).toBe('Your own words, without a preset label');
        expect(selectReportInsights(analysis)).toHaveLength(1);
        expect(analysis.conversation).not.toBeNull();
        expect(analysis.players).toEqual([]);
        expect(analysis.signals.every(signal => signal.total === 0)).toBe(true);
        const archive = partyReportText(completed, 'archive');
        expect(archive).toContain('Other — A different kind of answer.');
        expect(archive).not.toContain('undefined');
        if (['pick-my-poison', 'if-i-were-you'].includes(completed.gameType)) expect(archive).toContain('Other — Maybe a little time together first.');
        const markup = renderToStaticMarkup(<PartyReport game={completed} />);
        expect(markup).not.toContain('matched in every completed round');
        expect(markup).toContain('Written responses are not automatically');
        if (['if-i-were-you', 'when-things-get-hard'].includes(completed.gameType)) expect(analyzeRelationshipGame(completed).headline).toBe(analysis.headline);
        expect(combineAnalyses([{ title: definition.title, analysis }]).insights.length).toBeGreaterThan(0);
      } else {
        const report = buildReflection(completed);
        expect(report.total).toBe(3);
        expect(report.counts).toEqual({ verdict: 0, emotion: 0, values: 0 });
        expect(report.sharedGround).toEqual([]);
        expect(report.differentPerspectives).toEqual([]);
        expect(report.sameTakeDifferentFeeling).toEqual([]);
        expect(report.players.every(player => player.feelings.length === 0 && player.priorities.length === 0)).toBe(true);
        expect(analyzeSamePage(report).headline).toBe('Your own words, without a preset label');
        const archive = reflectionText(report, 'archive');
        for (const text of [writtenPage.customVerdict, writtenPage.customEmotion, writtenPage.customFactor]) expect(archive).toContain(text);
        expect(archive).not.toContain('undefined');
        expect(archive).not.toContain('same choices in every completed scenario');
        expect(renderToStaticMarkup(<CompatibilityReport game={completed} />)).not.toContain('same choices in every completed scenario');
      }
    }
  });
  it('does not disclose first submissions through the pass-device or online waiting screen', () => {
    const initial = createChoiceGame('if-i-were-you', 'local', ['Mia', 'Sam'], 3, 30);
    const first = submitChoiceAnswer(initial, initial.players[0].id, writtenChoice(initial));
    for (const mode of ['local', 'online'] as const) {
      const markup = renderToStaticMarkup(<PartyGame game={{ ...first, mode }} myId={first.players[0].id} busy={false} now={0} onSubmit={noOp} onContinue={noOp} onReplay={noOp} onExit={noOp} />);
      expect(markup).not.toContain('A different kind of answer.');
      expect(markup).not.toContain('Maybe a little time together first.');
    }
  });
  it('leaves mixed written/structured predictions unassessed, and safely escapes literal answers', () => {
    let game = createChoiceGame('if-i-were-you', 'demo', ['Mia', 'Sam'], 3, 30);
    game = submitChoiceAnswer(game, game.players[0].id, { choice: OTHER_ANSWER, customChoice: '<script>alert("text")</script>', prediction: 0, explanation: '' });
    game = submitChoiceAnswer(game, game.players[1].id, { choice: 0, prediction: OTHER_ANSWER, customPrediction: 'Different words', explanation: '' });
    expect(partyRecap(game).rounds[0].predictionMatches).toEqual([true, null]);
    const markup = renderToStaticMarkup(<PartyGame game={game} myId={game.players[0].id} busy={false} now={0} onSubmit={noOp} onContinue={noOp} onReplay={noOp} onExit={noOp} />);
    expect(markup).toContain('&lt;script&gt;');
    expect(markup).not.toContain('<script>');
    expect(markup).toContain('without automatic matching');
  });
  it('keeps written evidence in playlist archives without inventing shared or different choices', () => {
    let game = createNight('local', ['Mia', 'Sam'], ['same-page', 'same-brain', 'if-i-were-you'], 3, 30);
    while (!game.night?.finished) {
      game = finish(game);
      const index = game.night!.index;
      game = advanceNight(advanceNight(game, game.players[0].id, index), game.players[1].id, index);
      game = JSON.parse(JSON.stringify(game));
    }
    const report = nightReflection(game);
    expect(report.summaries.every(summary => summary.shared.length === 0 && summary.discoveries.length === 0)).toBe(true);
    expect(report.analysis.insights.length).toBeGreaterThan(0);
    const archive = nightReportText(game, 'archive');
    expect(archive).toContain(writtenPage.customVerdict);
    expect(archive).toContain('A different kind of answer.');
    expect(archive).not.toContain('undefined');
  });
  it('bases automated patterns only on the remaining fully predefined rounds', () => {
    let game = createGame('demo', ['Mia', 'Sam'], 3, 30);
    for (let round = 0; round < 3; round++) {
      for (const player of game.players) game = submitAnswer(game, player.id, round === 0 ? writtenPage : { verdict: 0, emotion: 1, factor: 2, explanation: '' });
      game = readyForNext(readyForNext(game, game.players[0].id), game.players[1].id);
    }
    const report = buildReflection(game);
    expect(report.total).toBe(3);
    expect(report.structured?.total).toBe(2);
    expect(report.structured?.players[0].feelings).toEqual([{ label: 'Confused / uncomfortable', count: 2 }]);
    expect(analyzeSamePage(report).signals.every(signal => signal.total === 2)).toBe(true);
    expect(analyzeSamePage(report).scope).toContain('only fully predefined');
  });
});
