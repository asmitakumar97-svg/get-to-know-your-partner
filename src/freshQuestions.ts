import { legacyPageBank, offlineBank } from './offlineQuestions';
import type { NightEntry } from './night';
import type { SessionState } from './game';
import { isRecord, parseQuestionRequest, questionFingerprint, samePageReasons, samePageVerdicts, validateQuestions, type QuestionRequest } from '../supabase/functions/_shared/questions';
import { type GameId, partyDecks } from './catalog';
import { isRelationshipGame } from './relationshipGames';
import { buildAdventureDeck, type AdventureId } from './adventures';

export type PlayRequest = Omit<QuestionRequest, 'game'> & { game: GameId; category?: string; adventure?: AdventureId };

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
  const bank = request.sections ? legacyPageBank : offlineBank(request.game);
  const groups = request.sections?.map(section => ({ candidates: bank.filter(item => item.category === section), count: 5 })) ?? [{ candidates: bank, count: request.count }];
  const deck = groups.flatMap(({ candidates, count }) => {
    const unseen = shuffle(candidates.filter(item => !seen.includes(questionFingerprint(item))));
    const previous = candidates.filter(item => seen.includes(questionFingerprint(item)))
      .sort((a, b) => seen.indexOf(questionFingerprint(a)) - seen.indexOf(questionFingerprint(b)));
    if (candidates.length < count) throw new Error('The offline bank does not have enough questions for this game.');
    return [...unseen, ...previous].slice(0, count).map(question => request.game === 'same-page'
      ? { ...question, verdictOptions: [...samePageVerdicts], reasonOptions: samePageReasons.map(reason => reason.label) }
      : question);
  });
  const repeated = deck.some(item => seen.includes(questionFingerprint(item)));
  const entry: NightEntry = request.game === 'same-page'
    ? { gameType: request.game, deck: validateQuestions({ ...request, game: request.game }, { questions: deck }) }
    : { gameType: request.game, deck: validateQuestions({ ...request, game: request.game }, { questions: deck }) };
  return { entry, repeated };
}

export async function prepareQuestions(requests: PlayRequest[], generator: QuestionGenerator | null, storage: Pick<Storage, 'getItem'> = localStorage): Promise<{ entries: NightEntry[]; notice: string }> {
  let history: QuestionHistory = {};
  const notices = new Set<string>();
  try { history = readQuestionHistory(storage); }
  catch (error) { notices.add(error instanceof Error ? error.message : 'Question history could not be read. Repeat tracking is unavailable.'); }
  const entries: NightEntry[] = [];
  for (const settings of requests) {
    if (isRelationshipGame(settings.game)) {
      if (settings.game === 'us-against-the-world') {
        entries.push({ gameType: settings.game, deck: buildAdventureDeck(settings.adventure) });
      } else {
        const candidates = partyDecks[settings.game].filter(question => !settings.category || question.category === settings.category);
        if (![3, 5, 10, 20, 30].includes(settings.count) || settings.count > candidates.length) throw new Error('Choose a length available for this category (up to 30 mixed questions or 5 in one category).');
        const seen = history[settings.game] ?? [];
        const fresh = shuffle(candidates.filter(q => !seen.includes(questionFingerprint(q))));
        const previous = shuffle(candidates.filter(q => seen.includes(questionFingerprint(q))));
        entries.push({ gameType: settings.game, deck: [...fresh, ...previous].slice(0, settings.count) });
        if (fresh.length < settings.count) notices.add('Some familiar questions are returning after this curated selection has been explored.');
      }
      notices.add('Using the original curated library. Answers, clues and reflections are not sent to an AI service.');
      continue;
    }
    const request: QuestionRequest = { game: settings.game, count: settings.count, ...(settings.sections ? { sections: settings.sections } : {}) };
    parseQuestionRequest(request);
    const seen = history[request.game] ?? [];
    if (generator && request.game !== 'same-page') {
      try {
        const response = await generator(request);
        const deck = validateQuestions({ ...request, game: request.game }, response);
        if (deck.some(question => seen.includes(questionFingerprint(question)))) throw new Error('The generated deck repeated a question from this device.');
        entries.push({ gameType: request.game, deck });
        continue;
      } catch (error) {
        notices.add(`Fresh online questions unavailable: ${error instanceof Error ? error.message : 'Question service failed.'} Using the offline bank instead.`);
      }
    } else notices.add(request.game === 'same-page'
      ? 'Using the curated Same Page? library, with repeats avoided on this browser until all 100 situations have been explored.'
      : 'Using the offline question bank. Fresh AI questions need an internet connection and the configured question service.');
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
