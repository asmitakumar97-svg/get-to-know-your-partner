export const questionGames = ['same-page', 'same-brain', 'pick-my-poison', 'read-the-room', 'more-likely'] as const;
export type QuestionGame = typeof questionGames[number];
export const partyRoundCounts: readonly number[] = [3, 5, 10, 20, 30, 50];
export const samePageTopics = [
  'Boundaries, flirting & micro-cheating', 'Exes, friendships & social circles',
  'Social media & digital boundaries', 'Respect, arguments & apologies',
  'Emotional needs, attention & communication', 'Time, effort & priorities',
  'Money, gifts & generosity', 'Commitment, future & major life choices',
  'Personal boundaries, autonomy & everyday life',
] as const;
export const samePageVerdicts = [
  'Nothing wrong', 'Boundary-crossing', 'Disrespectful', 'Micro-cheating', 'Cheating', 'Okay since we discussed',
] as const;
export const verdictScales = {
  boundaries: ['Nothing wrong', 'Depends on context', 'Boundary-crossing', 'Red flag / disrespectful', 'Cheating'],
  respect: ['Reasonable', 'Depends on context', 'Thoughtless', 'Disrespectful', 'Unacceptable'],
  communication: ['Healthy difference', 'Needs discussion', 'Unmet need', 'Concerning pattern', 'Dealbreaker'],
  money: ['Fair', 'Depends on circumstances', 'Unbalanced', 'Unfair', 'Dealbreaker'],
  future: ['Compatible', 'Needs discussion', 'Important difference', 'Major incompatibility', 'Dealbreaker'],
} as const;
export const samePageReasons = [
  { label: 'What actually happened', description: 'The behaviour itself matters most to me, regardless of the explanation.' },
  { label: 'Why they did it', description: 'Their intentions and the context change how I feel.' },
  { label: 'Whether they told me', description: "I'd feel differently if my partner told me openly instead of hiding it." },
  { label: "Whether we'd agreed on this", description: "I'd consider the boundaries and expectations we've discussed as a couple." },
  { label: 'Whether they respect my feelings', description: 'How they respond when they learn something hurt or upset me matters most.' },
  { label: 'How it affects our relationship', description: "I'd consider the impact on trust, respect, and how safe I feel with my partner." },
] as const;
export const topicVerdicts: Record<typeof samePageTopics[number], keyof typeof verdictScales> = {
  [samePageTopics[0]]: 'boundaries', [samePageTopics[1]]: 'boundaries',
  [samePageTopics[2]]: 'respect', [samePageTopics[3]]: 'respect',
  [samePageTopics[4]]: 'communication', [samePageTopics[5]]: 'communication',
  [samePageTopics[6]]: 'money', [samePageTopics[7]]: 'future', [samePageTopics[8]]: 'respect',
};
export const questionTopics = ['Boundaries', 'Trust', 'Respect', 'Communication', 'Independence', 'Future expectations'] as const;
export type QuestionTopic = typeof questionTopics[number];
export interface QuestionRequest { game: QuestionGame; count: number; sections?: QuestionTopic[] }
export interface Question { id: string; title: string; text: string; category: string; prompt: string; verdictOptions?: readonly string[]; reasonOptions?: readonly string[] }
export interface ChoiceQuestion extends Question { options: string[]; level: number }
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isGame = (value: unknown): value is QuestionGame => questionGames.some(game => game === value);
const isTopic = (value: unknown): value is QuestionTopic => questionTopics.some(topic => topic === value);
const isSamePageTopic = (value: string): value is typeof samePageTopics[number] => samePageTopics.some(topic => topic === value);

export function parseQuestionRequest(value: unknown): QuestionRequest {
  if (!isRecord(value) || !isGame(value.game) || !Number.isInteger(value.count) || typeof value.count !== 'number') throw new Error('Invalid question request.');
  if (Object.keys(value).some(key => !['game', 'count', 'sections'].includes(key))) throw new Error('Only game settings may be sent for question generation.');
  let selected: QuestionTopic[] | undefined;
  if (value.sections !== undefined) {
    if (value.game !== 'same-page' || !Array.isArray(value.sections) || !value.sections.length || !value.sections.every(isTopic) || new Set(value.sections).size !== value.sections.length) throw new Error('Invalid question sections.');
    selected = value.sections;
  }
  if (selected ? value.count !== selected.length * 5 : !partyRoundCounts.includes(value.count)) throw new Error('Invalid question count.');
  return { game: value.game, count: value.count, ...(selected ? { sections: selected } : {}) };
}

export function questionFingerprint(question: Pick<Question, 'text'>): string {
  const text = question.text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

function textField(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Generated question text is missing or too long.');
  return value.trim();
}

export function validateQuestions(request: QuestionRequest & { game: 'same-page' }, value: unknown): Question[];
export function validateQuestions(request: QuestionRequest & { game: Exclude<QuestionGame, 'same-page'> }, value: unknown): ChoiceQuestion[];
export function validateQuestions(request: QuestionRequest, value: unknown): (Question | ChoiceQuestion)[];
export function validateQuestions(request: QuestionRequest, value: unknown): (Question | ChoiceQuestion)[] {
  parseQuestionRequest(request);
  if (!isRecord(value) || !Array.isArray(value.questions) || value.questions.length !== request.count) throw new Error('The question service returned an incomplete deck.');
  const questions = value.questions.map((item, i) => {
    if (!isRecord(item)) throw new Error('Invalid generated question.');
    const base: Question = {
      id: `fresh-${request.game}-${i}-${crypto.randomUUID()}`,
      title: textField(item.title, 90), text: textField(item.text, 500),
      category: textField(item.category, 60), prompt: textField(item.prompt, 300),
    };
    if (/\b(boyfriend|girlfriend|husband|wife|he|she|his|her)\b/i.test(`${base.title} ${base.text} ${base.prompt}`)) throw new Error('Questions must use gender-neutral language.');
    if (request.game === 'same-page') {
      if ((!isTopic(base.category) && !isSamePageTopic(base.category)) || (request.sections && base.category !== request.sections[Math.floor(i / 5)])) throw new Error('Generated questions do not match the selected sections.');
      const legacyOptions = isSamePageTopic(base.category) ? verdictScales[topicVerdicts[base.category]] : undefined;
      const suppliedVerdicts = item.verdictOptions;
      const options = suppliedVerdicts === undefined
        ? isSamePageTopic(base.category) ? samePageVerdicts : undefined
        : [samePageVerdicts, ...(legacyOptions ? [legacyOptions] : [])].find(candidate =>
          Array.isArray(suppliedVerdicts) && suppliedVerdicts.length === candidate.length && candidate.every((option, index) => suppliedVerdicts[index] === option));
      if (suppliedVerdicts !== undefined && !options) throw new Error('Invalid scenario verdict options.');
      const suppliedReasons = item.reasonOptions;
      if (suppliedReasons !== undefined && (!Array.isArray(suppliedReasons) || suppliedReasons.length !== samePageReasons.length || !samePageReasons.every((reason, index) => suppliedReasons[index] === reason.label))) throw new Error('Invalid scenario reasoning options.');
      if (options) base.verdictOptions = [...options];
      if (isSamePageTopic(base.category) || suppliedReasons !== undefined) base.reasonOptions = samePageReasons.map(reason => reason.label);
      return base;
    }
    const optionCount = request.game === 'pick-my-poison' ? 2 : request.game === 'more-likely' ? 3 : 4;
    if (!Array.isArray(item.options) || item.options.length !== optionCount) throw new Error('Generated answer options do not match the game.');
    const options = item.options.map(option => textField(option, 100));
    if (new Set(options.map(option => option.toLowerCase())).size !== optionCount) throw new Error('Generated answer options must be different.');
    if (request.game === 'more-likely' && (options[0] !== 'Player one' || options[1] !== 'Player two' || options[2] !== 'Both of us')) throw new Error('Player choices must use stable player positions and Both of us.');
    if (typeof item.level !== 'number' || !Number.isInteger(item.level) || item.level < 0 || item.level > 3) throw new Error('Generated question difficulty is invalid.');
    if (/\b(boyfriend|girlfriend|husband|wife|he|she|his|her)\b/i.test(options.join(' '))) throw new Error('Answer options must be gender-neutral.');
    return { ...base, options, level: item.level };
  });
  if (new Set(questions.map(questionFingerprint)).size !== questions.length) throw new Error('The question service returned repeated questions.');
  if (request.game === 'pick-my-poison') questions.sort((a, b) => ('level' in a ? a.level : 0) - ('level' in b ? b.level : 0));
  return questions;
}
