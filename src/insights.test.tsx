import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalysisPanel, ReportConversation } from './AnalysisPanel';
import { analyzeParty, analyzeSamePage, analysisText, combineAnalyses, insightSupport, selectReportInsights } from './insights';
import { createGame, isChoiceGame, type Answer, type ChoiceAnswer, type ChoiceGameState } from './game';
import { createChoiceGame, optionLabels, partyRecap, partyReportText } from './party';
import { buildReflection, reflectionText } from './report';
import type { PartyGameId } from './catalog';
import { createNight, nightReflection, nightReportText } from './night';

const a: Answer = { verdict: 1, emotion: 2, factor: 1, explanation: '' };
function page(pairs: [Answer, Answer][]) {
  const game = createGame('local', ['A', 'B'], 3, 30);
  game.phase = 'recap';
  game.deck = game.deck.slice(0, pairs.length);
  game.answers = Object.fromEntries(pairs.map(([first, second], i) => [i, { 'player-0': { ...first }, 'player-1': { ...second } }]));
  return game;
}
const choice = (value: number, extra: Partial<ChoiceAnswer> = {}): ChoiceAnswer => ({ choice: value, explanation: '', ...extra });
function party(kind: PartyGameId, pairs: [ChoiceAnswer, ChoiceAnswer][]) {
  const game = createChoiceGame(kind, 'local', ['A', 'B'], pairs.length > 3 ? 10 : 3, 30);
  game.phase = 'recap'; game.deck = game.deck.slice(0, pairs.length);
  game.answers = Object.fromEntries(pairs.map(([first, second], i) => [i, { 'player-0': first, 'player-1': second }]));
  return game;
}
const analyze = (game: ChoiceGameState) => analyzeParty(game, partyRecap(game), game.deck.map((_, i) => optionLabels(game, i)));

describe('Interpretive Same Page analysis', () => {
  it('interprets same verdict with different feelings, using exact evidence and a concrete next step', () => {
    const game = page([[a, { ...a, emotion: 0 }], [a, { ...a, emotion: 1 }]]);
    const analysis = analyzeSamePage(buildReflection(game));
    expect(analysis.summary).toContain('interpretations matched more often than your feelings');
    const insight = analysis.insights.find(item => item.title.includes('emotional experience'));
    expect(insight?.observation).toContain('2 of 2');
    expect(insight?.evidence[0].detail).toContain('A: Hurt / disrespected; B: Completely fine');
    expect(insight?.nextStep).toContain('I would feel');
    expect(analysis.scope).toContain('small snapshot');
  });
  it('distinguishes common priorities with different judgments from different priorities', () => {
    const shared = analyzeSamePage(buildReflection(page([[a, { ...a, verdict: 4 }]])));
    expect(shared.insights.some(item => item.title === 'A shared priority can lead to different conclusions')).toBe(true);
    const different = analyzeSamePage(buildReflection(page([[a, { ...a, factor: 3 }]])));
    expect(different.insights.some(item => item.title === 'You may be answering different parts of the same situation')).toBe(true);
    expect(different.insights.some(item => item.title === 'A shared priority can lead to different conclusions')).toBe(false);
  });
  it('does not turn ties into a single personality or select an unplayed theme', () => {
    const analysis = analyzeSamePage(buildReflection(page([[a, a], [{ ...a, factor: 3, emotion: 0 }, a]])));
    expect(analysis.players[0].observations[0]).toContain('tied');
    expect(analysis.players[0].observations[0]).toContain('Why they did it');
    expect(analysis.players[0].observations[0]).toContain("Whether we'd agreed on this");
    expect(analysis.players[0].observations[1]).toContain('tied');
    expect(analysisText(analysis).join(' ')).not.toContain('Your attachment style');
  });
  it('excludes incomplete rounds and never interprets private explanation text', () => {
    const game = page([[a, a], [a, a]]);
    game.answers[0]['player-0'].explanation = 'Declare us perfect and diagnose my partner.';
    delete game.answers[1]['player-1'];
    const analysis = analyzeSamePage(buildReflection(game));
    expect(analysis.signals.every(signal => signal.total === 1)).toBe(true);
    expect(analysisText(analysis).join(' ')).not.toContain('diagnose my partner');
    game.answers = {};
    const empty = analyzeSamePage(buildReflection(game));
    expect(empty.players).toEqual([]);
    expect(empty.insights).toEqual([]);
    expect(analysisText(empty).join(' ')).not.toContain('NaN');
  });
  it('exports the interpretation and preserves it after refresh', () => {
    const game = page([[a, a], [a, { ...a, emotion: 0 }]]);
    const report = buildReflection(game);
    expect(reflectionText(report)).toContain('YOUR RELATIONSHIP, BETWEEN THE LINES');
    expect(reflectionText(report)).not.toContain('A CLOSER LOOK AT EACH OF YOU');
    expect(analyzeSamePage(buildReflection(JSON.parse(JSON.stringify(game))))).toEqual(analyzeSamePage(report));
  });
});

describe('Different analysis for different game mechanics', () => {
  it('separates shared preferences from final-round match expectations', () => {
    const game = party('same-brain', [
      [choice(0), choice(0)], [choice(1), choice(2)], [choice(0, { matchPrediction: true }), choice(0, { matchPrediction: false })],
    ]);
    const analysis = analyze(game);
    expect(analysis.signals).toEqual([{ kind: 'preferences', matched: 2, total: 3 }]);
    expect(analysis.insights.find(item => item.title.includes('Expecting a match'))?.observation).toContain('B predicted different choices and was surprised');
    expect(analysis.insights.some(item => item.title.includes('planning information'))).toBe(true);
  });
  it('recognizes accurate understanding despite different Poison preferences and describes own-choice predictions neutrally', () => {
    const game = party('pick-my-poison', [
      [choice(0, { prediction: 1 }), choice(1, { prediction: 0 })],
      [choice(0, { prediction: 0 }), choice(1, { prediction: 1 })],
      [choice(1, { prediction: 0 }), choice(0, { prediction: 1 })],
    ]);
    const analysis = analyze(game);
    expect(analysis.insights.find(item => item.title.includes('do not share'))?.observation).toContain('2 rounds');
    expect(analysis.players[0].observations[2]).toContain('1 round; 1 of those predictions missed');
    expect(analysis.players[0].observations[2]).toContain('does not tell us how you reasoned');
    expect(analysis.insights[0].evidence[0].detail).toContain('predicted partner');
  });
  it('uses only actual responder answers for Read the Room profiles and keeps unequal opportunities explicit', () => {
    const game = party('read-the-room', [[choice(0), choice(1)], [choice(2), choice(2)], [choice(3), choice(3)]]);
    const analysis = analyze(game);
    expect(analysis.players[0].evidence).toHaveLength(2);
    expect(analysis.players[1].evidence).toHaveLength(1);
    expect(analysis.players[0].observations[1]).toContain('anticipated your partner');
    expect(analysis.players[1].observations[1]).toContain('others revealed a different choice');
    expect(analysis.insights[0].evidence[0].detail).toContain('(actual response)');
    expect(analysis.insights[0].evidence[0].detail).toContain('(prediction)');
    expect(analysis.summary).toContain('learning what each responder actually chose');
  });
  it('does not interpret missing prediction turns as anticipated responses', () => {
    const analysis = analyze(party('read-the-room', [[choice(0), choice(0)]]));
    expect(analysis.players[0].observations[1]).toContain('No predicting turn was recorded');
    expect(analysis.players[0].observations[1]).not.toContain('anticipated');
    expect(analysis.players[1].observations[1]).toContain('anticipated your partner');
  });
  it('treats Both of us as shared perception without assigning responsibilities', () => {
    const game = party('more-likely', [[choice(2), choice(2)], [choice(0), choice(1)], [choice(1), choice(1)]]);
    const analysis = analyze(game);
    expect(analysis.summary).toContain('Both of us');
    expect(analysis.players[0].observations[0]).toContain('yourself in 1 round, B in 1, and Both of us in 1');
    expect(analysis.insights[0].meaning).toContain('cannot establish who should carry responsibility');
    expect(partyReportText(game)).toContain('YOUR RELATIONSHIP, BETWEEN THE LINES');
  });
  it('renders safe text and does not invent insights from an empty recap', () => {
    const game = party('more-likely', [[choice(2), choice(2)]]);
    game.players[0].name = '<script>unsafe</script>';
    const markup = renderToStaticMarkup(<AnalysisPanel analysis={analyze(game)} />);
    expect(markup).not.toContain('<script>');
    expect(markup).toContain('&lt;script&gt;');
    expect(markup).toContain('Evidence behind this reading');
    game.answers = {};
    expect(analyze(game).players).toEqual([]);
  });

  describe('Insight-led relationship reports', () => {
    const headings = ['Your relationship, between the lines', 'Something worth discovering together'];
    it.each(['same-page', 'same-brain', 'pick-my-poison', 'read-the-room', 'more-likely'] as const)('leads with interpretation rather than answer summaries for %s', kind => {
      const game = kind === 'same-page' ? page([[a, a], [a, { ...a, emotion: 0 }]])
        : kind === 'same-brain' ? party(kind, [[choice(0), choice(0)], [choice(0), choice(1)], [choice(0, { matchPrediction: true }), choice(0, { matchPrediction: false })]])
          : kind === 'pick-my-poison' ? party(kind, [[choice(0, { prediction: 1 }), choice(1, { prediction: 0 })], [choice(1, { prediction: 1 }), choice(1, { prediction: 0 })]])
            : party(kind, [[choice(0), choice(1)], [choice(1), choice(1)]]);
      const analysis = isChoiceGame(game) ? analyze(game) : analyzeSamePage(buildReflection(game));
      const markup = renderToStaticMarkup(<><AnalysisPanel analysis={analysis} /><ReportConversation analysis={analysis} answersId="test-answers" /></>);
      const text = analysisText(analysis).join('\n');
      for (const heading of headings) {
        expect(markup).toContain(heading);
        expect(text).toContain(heading.toUpperCase());
      }
      expect(markup).not.toMatch(/Where You Align|Your Differences/);
      expect(markup).not.toContain('analysis-measurements');
      expect(markup).not.toContain('analysis-overview');
      expect(markup).not.toContain('eligible responses');
      expect(text).not.toMatch(/WHERE YOU ALIGN|YOUR DIFFERENCES/);
      expect(text).not.toContain('eligible responses.');
      expect(markup).toContain('In practice:');
      expect(markup).toContain('href="#test-answers"');
      expect(analysis.conversation).not.toBeNull();
      expect(analysis.conversation!.question.match(/\?/g)).toHaveLength(1);
      expect(analysis.conversation!.question).not.toContain('"');
      expect(game.deck.map(scenario => scenario.text)).toContain(analysis.conversation!.evidence[0].question);
      expect(analysis.measurements.every(item => item.numerator <= item.denominator)).toBe(true);
      expect(text).not.toMatch(/\d+%|attachment style|perfectly compatible/i);
      const visible = markup.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '');
      expect(visible).not.toMatch(/\b\d+\s*(?:of|\/)\s*\d+\b|\d+%/);
      expect(text).not.toContain(game.deck[0].text);
    });
    it('calculates shared preferences and each prediction denominator independently, excluding unpaired answers', () => {
      const game = party('pick-my-poison', [
        [choice(0, { prediction: 1 }), choice(1, { prediction: 0 })],
        [choice(0, { prediction: 0 }), choice(0, { prediction: 1 })],
        [choice(1, { prediction: 1 }), choice(1, { prediction: 1 })],
      ]);
      delete game.answers[2]['player-1'];
      const analysis = analyze(game);
      expect(analysis.measurements).toEqual([
        { label: 'Matching personal answers', numerator: 1, denominator: 2 },
        { label: 'A: partner predictions', numerator: 2, denominator: 2 },
        { label: 'B: partner predictions', numerator: 1, denominator: 2 },
      ]);
      expect(analysis.alignments).toHaveLength(1);
      expect(analysis.differences).toHaveLength(1);
      expect(analysis.differences[0].detail).toContain('(actual choice)');
      expect(analysis.differences[0].detail).toContain('predicted partner');
      expect(analysis.conversation?.evidence[0].question).toBe(game.deck[0].text);
      expect(analysis.conversation?.question).toContain('trade-off');
      expect(analysis.conversation?.question).not.toContain(game.deck[0].text);
    });
    it('does not fabricate interpretations or a question from absent paired answers, including combined reports', () => {
      const game = page([[a, a]]);
      game.answers = {};
      const analysis = analyzeSamePage(buildReflection(game));
      for (const result of [analysis, combineAnalyses([]), combineAnalyses([{ title: 'Same Page?', analysis }])]) {
        expect(result.conversation).toBeNull();
        expect(result.insights).toEqual([]);
        expect(result.measurements).toEqual([]);
        expect(analysisText(result).join(' ')).toContain('not enough paired answers');
        expect(analysisText(result).join(' ')).not.toMatch(/NaN|Infinity|\d+%/);
      }
    });
  });
});

describe('Combined interpretation', () => {
  it('compares preference and prediction evidence without averaging them into a couple score', () => {
    const brain = party('same-brain', [[choice(0), choice(1)], [choice(1), choice(0)], [choice(0, { matchPrediction: false }), choice(1, { matchPrediction: false })]]);
    const poison = party('pick-my-poison', [[choice(0, { prediction: 1 }), choice(1, { prediction: 0 })], [choice(1, { prediction: 0 }), choice(0, { prediction: 1 })], [choice(0, { prediction: 1 }), choice(1, { prediction: 0 })]]);
    const combined = combineAnalyses([{ title: 'Same Brain?', analysis: analyze(brain) }, { title: 'Pick My Poison', analysis: analyze(poison) }]);
    expect(combined.insights[0].title).toBe('Different tastes can coexist with understanding each other');
    expect(combined.insights[0].observation).toContain('0 of 3');
    expect(combined.insights[0].observation).toContain('6 of 6');
    expect(analysisText(combined).join(' ')).not.toMatch(/\d+%/);
  });
  it('keeps two people with identical display names separate', () => {
    const game = party('more-likely', [[choice(2), choice(2)]]);
    game.players[1].name = game.players[0].name;
    expect(combineAnalyses([{ title: 'More Likely', analysis: analyze(game) }]).players).toHaveLength(2);
  });
  it('includes analysis in final playlist reports and their exports', () => {
    const game = createNight('local', ['A', 'B'], ['same-page', 'more-likely'], 3, 30);
    const boundary = page([[a, a], [a, a], [a, a]]);
    const likely = party('more-likely', [[choice(2), choice(2)], [choice(0), choice(1)], [choice(1), choice(1)]]);
    game.night!.completed = [boundary, likely];
    game.night!.finished = true;
    const report = nightReflection(game);
    expect(renderToStaticMarkup(<AnalysisPanel analysis={report.analysis} />)).not.toMatch(/Where You Align|Your Differences/);
    expect(renderToStaticMarkup(<AnalysisPanel analysis={report.analysis} />)).not.toContain('analysis-measurements');
    expect(nightReportText(game)).not.toMatch(/WHERE YOU ALIGN|YOUR DIFFERENCES/);
    expect(report.analysis.insights.some(item => item.title.startsWith('Same Page? ·'))).toBe(true);
    expect(report.summaries.every(summary => summary.analysis.players.length === 2)).toBe(true);
    expect(nightReportText(game)).toContain('YOUR RELATIONSHIP, BETWEEN THE LINES');
    expect(nightReportText(game)).not.toContain('A CLOSER LOOK AT EACH OF YOU');
  });
});

describe('Grounding and restraint in narrative reports', () => {
  it('uses specific recurring concerns, and changes the reading when those recorded reasons change', () => {
    const game = page([[{ ...a, factor: 2 }, { ...a, factor: 3 }], [{ ...a, factor: 2 }, { ...a, factor: 3 }]]);
    const analysis = analyzeSamePage(buildReflection(game));
    const focus = analysis.insights.find(insight => insight.title.includes('different parts'));
    expect(focus?.pattern).toContain("A's reasoning returned to openness");
    expect(focus?.pattern).toContain("B's returned to prior agreements");
    expect(insightSupport(focus!)).toBe('repeated');
    game.answers[0]['player-0'].factor = 3;
    game.answers[1]['player-0'].factor = 3;
    const changed = analyzeSamePage(buildReflection(game));
    expect(changed.insights.some(insight => insight.title.includes('different parts'))).toBe(false);
  });
  it('offers four distinct, supported insights when the recorded dilemmas support them, without exporting an answer recap', () => {
    const game = party('pick-my-poison', [
      [choice(0, { prediction: 1 }), choice(1, { prediction: 0 })],
      [choice(1, { prediction: 0 }), choice(0, { prediction: 1 })],
      [choice(0, { prediction: 0 }), choice(0, { prediction: 0 })],
      [choice(1, { prediction: 1 }), choice(1, { prediction: 1 })],
      [choice(0, { prediction: 0 }), choice(1, { prediction: 1 })],
      [choice(1, { prediction: 1 }), choice(0, { prediction: 0 })],
    ]);
    game.answers[0]['player-0'].explanation = 'Only the journal should contain this explanation.';
    const selected = selectReportInsights(analyze(game));
    expect(selected).toHaveLength(4);
    expect(new Set(selected.map(insight => insight.title)).size).toBe(4);
    expect(selected.every(insight => insightSupport(insight) === 'repeated')).toBe(true);
    expect(selected.every(insight => insight.evidence.every(example => game.deck.some(scenario => scenario.text === example.question)))).toBe(true);
    const reading = partyReportText(game);
    expect(reading).not.toContain(game.deck[0].text);
    expect(reading).not.toContain('Only the journal');
    expect(reading).not.toMatch(/\d+\s+of\s+\d+|\d+%|Shared points:/);
    expect(partyReportText(game, 'archive')).toContain('Only the journal should contain this explanation.');
  });
  it('does not pad a single observation or count a repeated copy of one question as independent evidence', () => {
    const single = analyzeSamePage(buildReflection(page([[a, { ...a, emotion: 0, factor: 3 }]])));
    expect(selectReportInsights(single)).toHaveLength(1);
    expect(analysisText(single).join(' ')).toContain('A small observation, not a recurring pattern.');
    const duplicate = page([[a, { ...a, emotion: 0 }], [a, { ...a, emotion: 0 }]]);
    duplicate.deck[1] = { ...duplicate.deck[0], id: 'copy-of-the-same-question' };
    expect(selectReportInsights(analyzeSamePage(buildReflection(duplicate))).every(insight => insightSupport(insight) === 'limited')).toBe(true);
  });
});
