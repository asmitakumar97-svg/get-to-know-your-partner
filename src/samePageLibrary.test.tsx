import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { samePageReasons, samePageTopics, samePageVerdicts, validateQuestions, verdictScales } from '../supabase/functions/_shared/questions';
import { AnswerChoices } from './AnswerChoices';
import { CompatibilityReport } from './CompatibilityReport';
import { prepareQuestions, rememberQuestions } from './freshQuestions';
import { createGame, scenarioFactors, scenarioVerdicts, submitAnswer, validAnswer, verdicts } from './game';
import { buildReflection, reflectionText } from './report';
import { samePageLibrary } from './samePageLibrary';
import { scenarios } from './scenarios';

describe('Curated Same Page situations', () => {
  it('has exactly 100 distinct situations with the six requested verdicts in a consistent order', () => {
    expect(samePageLibrary).toHaveLength(100);
    expect(new Set(samePageLibrary.map(question => question.text)).size).toBe(100);
    expect(new Set(samePageLibrary.map(question => question.id)).size).toBe(100);
    expect(samePageTopics.map(topic => samePageLibrary.filter(question => question.category === topic).length)).toEqual([15, 10, 10, 15, 10, 10, 10, 10, 10]);
    for (const offset of [0, 50]) {
      const validated = validateQuestions({ game: 'same-page', count: 50 }, { questions: samePageLibrary.slice(offset, offset + 50) });
      expect(validated.map(question => question.verdictOptions)).toEqual(samePageLibrary.slice(offset, offset + 50).map(question => question.verdictOptions));
    }
    const future = samePageLibrary.find(question => question.category === samePageTopics[7])!;
    expect(scenarioVerdicts(future)).toEqual([
      'Nothing wrong', 'Boundary-crossing', 'Disrespectful', 'Micro-cheating', 'Cheating', 'Okay since we discussed',
    ]);
    expect(samePageLibrary.every(question => JSON.stringify(question.verdictOptions) === JSON.stringify(samePageVerdicts))).toBe(true);
    expect(scenarioVerdicts(scenarios[0])).toBe(verdicts);
  });
  it('uses all 100 questions before disclosing repeats, even with a configured AI service', async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const generator = async () => { throw new Error('The curated library must not call AI.'); };
    const request = { game: 'same-page' as const, count: 50 };
    const first = await prepareQuestions([request], generator, storage);
    rememberQuestions(createGame('local', ['A', 'B'], 50, 30, undefined, first.entries[0].deck), storage);
    const second = await prepareQuestions([request], generator, storage);
    expect(second.entries[0].deck.some(question => first.entries[0].deck.some(previous => previous.text === question.text))).toBe(false);
    rememberQuestions(createGame('local', ['A', 'B'], 50, 30, undefined, second.entries[0].deck), storage);
    const third = await prepareQuestions([request], generator, storage);
    expect(first.notice).not.toContain('unavailable');
    expect(third.notice).toContain('least-recently-used');
  });
  it('preserves earlier category-specific verdict wording through saved snapshots, reports, and downloads', () => {
    const game = createGame('local', ['Alex', 'Sam'], 3, 30);
    game.deck = [
      { ...samePageLibrary[60], verdictOptions: [...verdictScales.communication] },
      { ...samePageLibrary[70], verdictOptions: [...verdictScales.money] },
      { ...samePageLibrary[80], verdictOptions: [...verdictScales.future] },
    ];
    game.phase = 'recap';
    game.answers = Object.fromEntries(game.deck.map((_, round) => [round, {
      'player-0': { verdict: 2, emotion: 1, factor: 1, explanation: '' },
      'player-1': { verdict: 4, emotion: 1, factor: 1, explanation: '' },
    }]));
    const restored = JSON.parse(JSON.stringify(game));
    const report = buildReflection(restored);
    const download = reflectionText(report, 'archive');
    const markup = renderToStaticMarkup(<CompatibilityReport game={restored} />);
    for (const label of ['Unmet need', 'Unbalanced', 'Important difference', 'Dealbreaker']) {
      expect(download).toContain(label);
      expect(markup).toContain(label);
    }
    expect(download).not.toContain('Micro-cheating');
    expect(download).not.toContain('Cheating');
    expect(report.themes).toHaveLength(9);
  });
  it('rejects mismatched custom verdict labels instead of silently reinterpreting them', () => {
    expect(() => validateQuestions({ game: 'same-page', count: 3 }, { questions: [
      { ...samePageLibrary[80], verdictOptions: verdictScales.boundaries }, ...samePageLibrary.slice(81, 83),
    ] })).toThrow('verdict options');
  });
  it('offers six clearly explained reasons and preserves the last two through reports and analysis', () => {
    const game = createGame('local', ['Alex', 'Sam'], 3, 30);
    const options = scenarioFactors(game.deck[0]);
    expect(options).toEqual(samePageReasons.map(reason => reason.label));
    const choices = renderToStaticMarkup(<AnswerChoices name="factor" title="What matters most to you in this situation?" options={options} descriptions={samePageReasons.map(reason => reason.description)} selected={5} onChange={() => {}} />);
    expect((choices.match(/type="radio"/g) ?? []).length).toBe(6);
    expect((choices.match(/<small>/g) ?? []).length).toBe(6);
    const answer = { verdict: 1, emotion: 2, factor: 5, explanation: '' };
    const first = submitAnswer(game, 'player-0', answer);
    const both = submitAnswer(first, 'player-1', { ...answer, factor: 4 });
    expect(both.phase).toBe('discussion');
    expect(validAnswer({ ...answer, factor: 6 }, game.deck[0])).toBe(false);
    expect(validAnswer(answer, scenarios[0])).toBe(false);
    both.phase = 'recap';
    const report = buildReflection(JSON.parse(JSON.stringify(both)));
    const text = reflectionText(report, 'archive');
    expect(report.players[0].priorities).toEqual([{ label: 'How it affects our relationship', count: 1 }]);
    expect(report.players[1].priorities).toEqual([{ label: 'Whether they respect my feelings', count: 1 }]);
    expect(text).toContain('trust and emotional safety');
    expect(text).toContain('acknowledgement and care');
    expect(text).not.toContain('undefined');
    expect(text).toContain('How it affects our relationship');
  });
  it('accepts Okay since we discussed without reinterpreting it as a severity level or changing old saves', async () => {
    const game = createGame('local', ['Alex', 'Sam'], 3, 30);
    const verdictChoices = renderToStaticMarkup(<AnswerChoices title="What's your take?" name="verdict" options={scenarioVerdicts(game.deck[0])} selected={5} onChange={() => {}} />);
    expect((verdictChoices.match(/type="radio"/g) ?? []).length).toBe(6);
    expect(verdictChoices).toContain('Okay since we discussed');
    const answer = { verdict: 5, emotion: 0, factor: 3, explanation: '' };
    expect(validAnswer(answer, game.deck[0])).toBe(true);
    expect(validAnswer({ ...answer, verdict: 6 }, game.deck[0])).toBe(false);
    expect(validAnswer(answer, scenarios[0])).toBe(false);
    expect(validAnswer(answer, { ...game.deck[0], verdictOptions: verdictScales.boundaries })).toBe(false);
    const both = submitAnswer(submitAnswer(game, 'player-0', answer), 'player-1', answer);
    both.phase = 'recap';
    const report = buildReflection(JSON.parse(JSON.stringify(both)));
    expect(report.counts).toEqual({ verdict: 1, emotion: 1, values: 1 });
    expect(reflectionText(report, 'archive')).toContain('Same interpretation: Okay since we discussed.');
    expect(renderToStaticMarkup(<CompatibilityReport game={both} />)).toContain('Okay since we discussed');
    const storage = { getItem: () => null };
    const legacyReplay = await prepareQuestions([{ game: 'same-page', count: 5, sections: ['Trust'] }], null, storage);
    expect(legacyReplay.entries[0].deck.every(question => JSON.stringify(question.verdictOptions) === JSON.stringify(samePageVerdicts))).toBe(true);
  });
});
