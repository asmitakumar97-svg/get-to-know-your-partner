import type { Answer, ChoiceAnswer } from './game';

export const OTHER_ANSWER = -2;
export const WRITTEN_ANSWER_LIMIT = 600;

export function validResponse(value: number | undefined, text: string | undefined, optionCount: number) {
  return value === OTHER_ANSWER
    ? typeof text === 'string' && text.trim().length > 0 && text.length <= WRITTEN_ANSWER_LIMIT
    : typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < optionCount && text === undefined;
}

export function responseLabel(options: readonly string[], value: number, text?: string): string {
  if (!validResponse(value, text, options.length)) throw new Error('A saved response is incomplete or invalid.');
  return value === OTHER_ANSWER ? `Other — ${text}` : options[value];
}

export function compareResponses(first: number, second: number): boolean | null {
  return first === OTHER_ANSWER || second === OTHER_ANSWER ? null : first === second;
}

export function hasWrittenPageAnswer(answer: Answer) {
  return [answer.verdict, answer.emotion, answer.factor].includes(OTHER_ANSWER);
}

export function hasWrittenChoiceAnswer(answer: ChoiceAnswer) {
  return answer.choice === OTHER_ANSWER || answer.prediction === OTHER_ANSWER;
}
