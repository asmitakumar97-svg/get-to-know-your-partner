export const questionGames = ['same-page', 'same-brain', 'pick-my-poison', 'read-the-room', 'more-likely'] as const;
export type QuestionGame = typeof questionGames[number];
export const questionTopics = ['Boundaries', 'Trust', 'Respect', 'Communication', 'Independence', 'Future expectations'] as const;
export type QuestionTopic = typeof questionTopics[number];
export interface QuestionRequest { game: QuestionGame; count: number; sections?: QuestionTopic[] }
export interface Question { id: string; title: string; text: string; category: string; prompt: string }
export interface ChoiceQuestion extends Question { options: string[]; level: number }
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isGame = (value: unknown): value is QuestionGame => questionGames.some(game => game === value);
const isTopic = (value: unknown): value is QuestionTopic => questionTopics.some(topic => topic === value);

export function parseQuestionRequest(value: unknown): QuestionRequest {
  if (!isRecord(value) || !isGame(value.game) || !Number.isInteger(value.count) || typeof value.count !== 'number') throw new Error('Invalid question request.');
  if (Object.keys(value).some(key => !['game', 'count', 'sections'].includes(key))) throw new Error('Only game settings may be sent for question generation.');
  let selected: QuestionTopic[] | undefined;
  if (value.sections !== undefined) {
    if (value.game !== 'same-page' || !Array.isArray(value.sections) || !value.sections.length || !value.sections.every(isTopic) || new Set(value.sections).size !== value.sections.length) throw new Error('Invalid question sections.');
    selected = value.sections;
  }
  if (selected ? value.count !== selected.length * 5 : ![3, 5, 10, 20].includes(value.count)) throw new Error('Invalid question count.');
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
      if (!isTopic(base.category) || (request.sections && base.category !== request.sections[Math.floor(i / 5)])) throw new Error('Generated questions do not match the selected sections.');
      return base;
    }
    const optionCount = request.game === 'pick-my-poison' || request.game === 'more-likely' ? 2 : 4;
    if (!Array.isArray(item.options) || item.options.length !== optionCount) throw new Error('Generated answer options do not match the game.');
    const options = item.options.map(option => textField(option, 100));
    if (new Set(options.map(option => option.toLowerCase())).size !== optionCount) throw new Error('Generated answer options must be different.');
    if (request.game === 'more-likely' && (options[0] !== 'Player one' || options[1] !== 'Player two')) throw new Error('Player choices must use stable player positions.');
    if (typeof item.level !== 'number' || !Number.isInteger(item.level) || item.level < 0 || item.level > 3) throw new Error('Generated question difficulty is invalid.');
    if (/\b(boyfriend|girlfriend|husband|wife|he|she|his|her)\b/i.test(options.join(' '))) throw new Error('Answer options must be gender-neutral.');
    return { ...base, options, level: item.level };
  });
  if (new Set(questions.map(questionFingerprint)).size !== questions.length) throw new Error('The question service returned repeated questions.');
  if (request.game === 'pick-my-poison') questions.sort((a, b) => ('level' in a ? a.level : 0) - ('level' in b ? b.level : 0));
  return questions;
}
