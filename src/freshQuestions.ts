import { offlineBank } from './offlineQuestions';
import type { NightEntry } from './night';
import type { SessionState } from './game';
import { isRecord, parseQuestionRequest, questionFingerprint, validateQuestions, type QuestionRequest } from '../supabase/functions/_shared/questions';

const HISTORY_KEY = 'playground-question-history-v1';
type QuestionHistory = Record<string, string[]>;
export type QuestionGenerator = (request: QuestionRequest) => Promise<unknown>;
const shuffle = <T,>(values: readonly T[]): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
export function readQuestionHistory(storage: Pick<Storage, 'getItem'>): QuestionHistory {
  const raw = storage.getItem(HISTORY_KEY);
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || Object.values(value).some(items => !Array.isArray(items) || items.some(item => typeof item !== 'string'))) throw new Error('Question history is unreadable; repeat tracking is unavailable on this device.');
  const history: QuestionHistory = {};
  for (const [key, items] of Object.entries(value)) if (Array.isArray(items) && items.every((item): item is string => typeof item === 'string')) history[key] = items;
  return history;
}
export function chooseOfflineQuestions(request: QuestionRequest, seen: readonly string[]): { entry: NightEntry; repeated: boolean } {
  parseQuestionRequest(request);
  const bank = offlineBank(request.game);
  const groups = request.sections?.map(section => ({ candidates: bank.filter(item => item.category === section), count: 5 })) ?? [{ candidates: bank, count: request.count }];
  const deck = groups.flatMap(({ candidates, count }) => {
    const unseen = shuffle(candidates.filter(item => !seen.includes(questionFingerprint(item))));
    const previous = candidates.filter(item => seen.includes(questionFingerprint(item)))
      .sort((a, b) => seen.indexOf(questionFingerprint(a)) - seen.indexOf(questionFingerprint(b)));
    if (candidates.length < count) throw new Error('The offline bank does not have enough questions for this game.');
    return [...unseen, ...previous].slice(0, count);
  });
  const repeated = deck.some(item => seen.includes(questionFingerprint(item)));
  const entry: NightEntry = request.game === 'same-page'
    ? { gameType: request.game, deck: validateQuestions({ ...request, game: request.game }, { questions: deck }) }
    : { gameType: request.game, deck: validateQuestions({ ...request, game: request.game }, { questions: deck }) };
  return { entry, repeated };
}

export async function prepareQuestions(requests: QuestionRequest[], generator: QuestionGenerator | null, storage: Pick<Storage, 'getItem'> = localStorage): Promise<{ entries: NightEntry[]; notice: string }> {
  let history: QuestionHistory = {};
  const notices = new Set<string>();
  try { history = readQuestionHistory(storage); }
  catch (error) { notices.add(error instanceof Error ? error.message : 'Question history could not be read. Repeat tracking is unavailable.'); }
  const entries: NightEntry[] = [];
  for (const request of requests) {
    parseQuestionRequest(request);
    const seen = history[request.game] ?? [];
    if (generator) {
      try {
        const response = await generator(request);
        const deck = request.game === 'same-page'
          ? validateQuestions({ ...request, game: request.game }, response)
          : validateQuestions({ ...request, game: request.game }, response);
        if (deck.some(question => seen.includes(questionFingerprint(question)))) throw new Error('The generated deck repeated a question from this device.');
        entries.push(request.game === 'same-page'
          ? { gameType: request.game, deck }
          : { gameType: request.game, deck: validateQuestions({ ...request, game: request.game }, response) });
        continue;
      } catch (error) {
        notices.add(`Fresh online questions unavailable: ${error instanceof Error ? error.message : 'Question service failed.'} Using the offline bank instead.`);
      }
    } else notices.add('Using the offline question bank. Fresh AI questions need an internet connection and the configured question service.');
    const fallback = chooseOfflineQuestions(request, seen);
    entries.push(fallback.entry);
    if (fallback.repeated) notices.add('You have explored this offline selection. Some least-recently-used questions are returning; online generation can add new ones.');
  }
  return { entries, notice: [...notices].join(' ') };
}

export function rememberQuestions(game: SessionState, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  const history = readQuestionHistory(storage);
  const entries = game.night?.playlist ?? [{ gameType: game.gameType ?? 'same-page', deck: game.deck }];
  for (const entry of entries) {
    const fresh = entry.deck.map(questionFingerprint);
    history[entry.gameType] = [...(history[entry.gameType] ?? []).filter(id => !fresh.includes(id)), ...fresh].slice(-5000);
  }
  storage.setItem(HISTORY_KEY, JSON.stringify(history));
}
