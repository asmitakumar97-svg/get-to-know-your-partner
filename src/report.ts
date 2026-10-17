import { alignment, emotions, factors, scenarioFactors, scenarioVerdicts, validAnswer, verdicts, type Answer, type GameState } from './game';
import { scenarios, type Scenario } from './scenarios';
import { samePageTopics } from '../supabase/functions/_shared/questions';
import { analyzeSamePage, analysisText, relationshipReportText, type ReportFormat } from './insights';
import { hasWrittenPageAnswer, OTHER_ANSWER, responseLabel } from './writtenAnswers';

export interface ReportRound {
  index: number;
  scenario: Scenario;
  answers: [Answer, Answer];
  matches: ReturnType<typeof alignment>;
  shared: string[];
  differences: string[];
  prompt: string;
}
export interface Frequency { label: string; count: number }
export interface ThemeReflection {
  category: string;
  rounds: ReportRound[];
  verdict: number;
  emotion: number;
  values: number;
}
export interface CompatibilityReflection {
  structured?: CompatibilityReflection;
  total: number;
  deckSize: number;
  isDemo: boolean;
  players: { id: string; name: string; feelings: Frequency[]; priorities: Frequency[]; carePrompts: string[] }[];
  rounds: ReportRound[];
  themes: ThemeReflection[];
  sharedGround: ReportRound[];
  differentPerspectives: ReportRound[];
  sameTakeDifferentFeeling: ReportRound[];
  counts: { verdict: number; emotion: number; values: number };
}

const axes = [
  { key: 'verdict', answer: 'verdict', label: 'interpretation', options: verdicts },
  { key: 'emotion', answer: 'emotion', label: 'feeling', options: emotions },
  { key: 'values', answer: 'factor', label: 'main factor', options: factors },
] as const;

const carePrompts = [
  'When something feels fine to you, how can you still make space for a different feeling?',
  'When you feel uncomfortable, would context, a check-in, or time to reflect help? Tell your partner what fits.',
  'When you feel hurt, what kind of acknowledgement or repair would you like to ask for?',
  'When you feel insecure, what reassurance could you ask for while respecting each other’s independence?',
  'When trust feels affected, what would rebuilding it look like for you? Talk about what you would need.',
];

function frequencies(answers: Answer[], field: 'emotion' | 'factor', options: readonly string[]): Frequency[] {
  return options.map((label, i) => ({ label, count: answers.filter(a => a[field] === i).length }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count || options.indexOf(a.label) - options.indexOf(b.label));
}

export function buildReflection(state: GameState): CompatibilityReflection {
  if (state.phase !== 'recap') throw new Error('Your reflection is available only after the game is complete.');
  if (state.players.length !== 2) throw new Error('A reflection needs two players.');
  const [first, second] = state.players;
  const rounds: ReportRound[] = [];
  for (const [index, scenario] of state.deck.entries()) {
    const a = state.answers[index]?.[first.id];
    const b = state.answers[index]?.[second.id];
    if (!a || !b) continue;
    if (!validAnswer(a, scenario) || !validAnswer(b, scenario)) throw new Error('A saved answer is invalid. The report cannot be generated accurately.');
    const matches = alignment(a, b);
    const shared: string[] = [];
    const differences: string[] = [];
    for (const axis of axes) {
      const options = axis.key === 'verdict' ? scenarioVerdicts(scenario) : axis.key === 'values' ? scenarioFactors(scenario) : axis.options;
      if (matches[axis.key]) shared.push(`Same ${axis.label}: ${options[a[axis.answer]]}.`);
      else if (matches[axis.key] === false) differences.push(`${first.name}: ${options[a[axis.answer]]}. ${second.name}: ${options[b[axis.answer]]}.`);
    }
    let prompt = scenario.prompt;
    if (matches.verdict && matches.emotion === false) {
      prompt += ` You chose the same verdict but different feelings. What would help each of you feel heard without having to change your verdict?`;
    } else if (matches.values === false) {
      prompt += ` ${first.name} selected "${scenarioFactors(scenario)[a.factor]}" and ${second.name} selected "${scenarioFactors(scenario)[b.factor]}". What agreement could make room for both priorities?`;
    } else if (Object.values(matches).every(Boolean)) {
      prompt += ' You selected the same three choices. Do your reasons match too, and what would you like to carry into real life?';
    } else if (Object.values(matches).includes(null)) {
      prompt += ' What would you like each other to understand about your own words? Written responses are not automatically matched or marked different.';
    }
    rounds.push({ index, scenario, answers: [a, b], matches, shared, differences, prompt });
  }
  const modern = state.deck.some(scenario => samePageTopics.some(topic => topic === scenario.category));
  const categories = [...new Set([...(modern ? samePageTopics : scenarios.map(s => s.category)), ...state.deck.map(s => s.category)])];
  const themes = categories.map(category => {
    const entries = rounds.filter(r => r.scenario.category === category);
    return {
      category, rounds: entries,
      verdict: entries.filter(r => r.matches.verdict).length,
      emotion: entries.filter(r => r.matches.emotion).length,
      values: entries.filter(r => r.matches.values).length,
    };
  });
  const structuredRounds = rounds.filter(round => !round.answers.some(hasWrittenPageAnswer));
  return {
    ...(structuredRounds.length !== rounds.length ? { structured: buildReflection({ ...state, answers: Object.fromEntries(structuredRounds.map(round => [round.index, state.answers[round.index]])) }) } : {}),
    total: rounds.length, deckSize: state.deck.length, isDemo: state.mode === 'demo', rounds, themes,
    counts: {
      verdict: rounds.filter(r => r.matches.verdict).length,
      emotion: rounds.filter(r => r.matches.emotion).length,
      values: rounds.filter(r => r.matches.values).length,
    },
    players: state.players.map((player, i) => {
      const answers = rounds.map(r => r.answers[i]);
      const selectedEmotions = emotions.map((_, emotion) => emotion).filter(emotion => answers.some(a => a.emotion === emotion));
      return {
        id: player.id, name: player.name,
        feelings: frequencies(answers, 'emotion', emotions),
        priorities: [...new Set(rounds.filter(round => round.answers[i].factor !== OTHER_ANSWER).map(round => scenarioFactors(round.scenario)[round.answers[i].factor]))]
          .map(label => ({ label, count: rounds.filter(round => scenarioFactors(round.scenario)[round.answers[i].factor] === label).length }))
          .sort((a, b) => b.count - a.count),
        carePrompts: selectedEmotions.map(emotion => carePrompts[emotion]),
      };
    }),
    sharedGround: rounds.filter(r => r.shared.length > 0),
    differentPerspectives: rounds.filter(r => r.differences.length > 0),
    sameTakeDifferentFeeling: rounds.filter(r => r.matches.verdict && r.matches.emotion === false),
  };
}

export function reflectionText(report: CompatibilityReflection, format: ReportFormat = 'insights'): string {
  const analysis = analyzeSamePage(report);
  if (format === 'insights') return relationshipReportText('Same Page?', report.players.map(player => player.name), analysis, report.isDemo);
  const lines = [
    'SAME PAGE? | YOUR COMPATIBILITY REFLECTION',
    report.players.map(p => p.name).join(' & '),
    ...(report.isDemo ? ['DEMO: one partner is simulated. This is not a report about a real couple.'] : []),
    `${report.total} of ${report.deckSize} scenarios have two complete answers.`,
    'A snapshot of selected answers, not a scientific compatibility assessment or prediction. No overall score. Different answers do not make either person wrong.',
    report.total < 5 ? 'This short session is a starting point, not a pattern or a complete picture.' : 'Repeated choices describe this session, not a fixed trait or a diagnosis.',
    '', ...analysisText(analysis, true),
    '', 'YOUR THREE THREADS',
    'Explore interpretations, feelings, and priorities separately. Neither perspective is wrong.',
    '', 'SHARED GROUND',
    ...report.sharedGround.map(r => `${r.scenario.title}: ${r.shared.join(' ')}`),
    ...(!report.sharedGround.length ? ['No exact shared choices in these scenarios. This does not measure the quality of your relationship.'] : []),
    '', 'DIFFERENT PERSPECTIVES',
    ...report.differentPerspectives.map(r => `${r.scenario.title}: ${r.differences.join(' ')}`),
    ...(!report.differentPerspectives.length ? [report.structured ? 'No automatic differences were found among comparable choices. Written responses are for discussion, not automatic matching.' : 'You selected the same choices in every completed scenario. Your reasons may still differ.'] : []),
    ...(report.sameTakeDifferentFeeling.length ? ['', 'SAME TAKE, DIFFERENT FEELINGS', ...report.sameTakeDifferentFeeling.map(r => `${r.scenario.title}: the verdict matched but feelings differed. Ask what care would feel supportive for each of you.`)] : []),
    '', 'YOUR THEMES',
    ...report.themes.map(t => t.rounds.length ? `${t.category}: ${t.rounds.length} scenarios explored.` : `${t.category}: not explored; no conclusion.`),
    '', 'FEELINGS, PRIORITIES & CARE',
    ...report.players.flatMap(p => [
      p.name, 'Selected feelings: ' + p.feelings.map(f => `${f.label} (${f.count})`).join(', '),
      'Selected priorities: ' + p.priorities.map(f => `${f.label} (${f.count})`).join(', '),
      ...p.carePrompts,
    ]),
    '', 'YOUR CONVERSATION JOURNAL',
    ...report.rounds.flatMap(r => [
      `${r.index + 1}. ${r.scenario.title} | ${r.scenario.category}`, r.scenario.text,
      ...report.players.flatMap((p, i) => [
        `${p.name}: ${responseLabel(scenarioVerdicts(r.scenario), r.answers[i].verdict, r.answers[i].customVerdict)} | ${responseLabel(emotions, r.answers[i].emotion, r.answers[i].customEmotion)} | ${responseLabel(scenarioFactors(r.scenario), r.answers[i].factor, r.answers[i].customFactor)}`,
        ...(r.answers[i].explanation ? [`In their words: ${r.answers[i].explanation}`] : []),
      ]),
      `Talk about it: ${r.prompt}`, '',
    ]),
    'YOUR CONVERSATION TO RETURN TO',
    ...(analysis.conversation ? [analysis.conversation.context, analysis.conversation.question] : ['There are not enough paired answers for a personalised conversation yet.']),
    'This file contains private answers. Save and share it only with both players’ agreement.',
  ];
  return lines.join('\n');
}
