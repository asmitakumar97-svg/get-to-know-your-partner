import { describe, expect, it } from 'vitest';
import { chooseOfflineQuestions, prepareQuestions, readQuestionHistory, rememberQuestions } from './freshQuestions';
import { offlineBank } from './offlineQuestions';
import { games } from './catalog';
import { createGame } from './game';
import { createNight } from './night';
import { sections, selectedSectionsFromDeck } from './scenarios';
import { parseQuestionRequest, questionFingerprint, validateQuestions, type QuestionRequest } from '../supabase/functions/_shared/questions';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
};
describe('Fresh questions and offline repeat avoidance', () => {
  it('ships over 600 distinct, gender-neutral offline situations with valid game shapes', () => {
    const banks = games.map(game => offlineBank(game.id));
    expect(banks.flat().length).toBeGreaterThan(600);
    for (const [index, bank] of banks.entries()) {
      expect(new Set(bank.map(questionFingerprint)).size).toBe(bank.length);
      for (const question of bank) {
        expect(JSON.stringify(question)).not.toMatch(/\b(boyfriend|girlfriend|husband|wife|he|she|his|her)\b/i);
      }
      const game = games[index].id;
      const deck = chooseOfflineQuestions({ game, count: 20 }, []).entry.deck;
      expect(deck).toHaveLength(20);
      expect(() => validateQuestions({ game, count: 20 }, { questions: deck })).not.toThrow();
    }
  });
  it('does not repeat on this device across new sessions or refreshes until a selection is exhausted', async () => {
    const storage = memory();
    const first = await prepareQuestions([{ game: 'same-page', count: 5, sections: ['Trust'] }], null, storage);
    const game = createGame('local', ['A', 'B'], 5, 30, ['Trust'], first.entries[0].deck);
    rememberQuestions(game, storage);
    const restored = JSON.parse(JSON.stringify(game));
    const second = await prepareQuestions([{ game: 'same-page', count: 5, sections: ['Trust'] }], null, storage);
    expect(second.entries[0].deck.some(question => restored.deck.some((old: { text: string }) => questionFingerprint(question) === questionFingerprint(old)))).toBe(false);
    expect(selectedSectionsFromDeck(second.entries[0].deck)).toEqual(['Trust']);
    expect(readQuestionHistory(storage)['same-page']).toHaveLength(5);
  });
  it('keeps exactly five questions per selected section and preserves all six on prepared playlists', async () => {
    const requests: QuestionRequest[] = [
      { game: 'same-page', count: 30, sections: [...sections] },
      { game: 'same-brain', count: 3 },
    ];
    const prepared = await prepareQuestions(requests, null, memory());
    const game = createNight('local', ['A', 'B'], ['same-page', 'same-brain'], 3, 30, sections, prepared.entries);
    expect(game.deck).toHaveLength(30);
    expect(game.night?.playlist[1].deck).toHaveLength(3);
    sections.forEach((section, i) => expect(game.deck.slice(i * 5, i * 5 + 5).every(question => question.category === section)).toBe(true));
    const storage = memory();
    rememberQuestions(game, storage);
    expect(readQuestionHistory(storage)['same-brain']).toHaveLength(3);
  });
  it('uses unseen questions first, then discloses least-recent repeats when offline supply runs out', async () => {
    const request: QuestionRequest = { game: 'more-likely', count: 3 };
    const bank = offlineBank('more-likely');
    const seen = bank.slice(0, -1).map(questionFingerprint);
    const result = chooseOfflineQuestions(request, seen);
    expect(result.repeated).toBe(true);
    expect(result.entry.deck[0].text).toBe(bank[bank.length - 1].text);
    expect(result.entry.deck[1].text).toBe(bank[0].text);
    const storage = memory();
    storage.setItem('playground-question-history-v1', JSON.stringify({ 'more-likely': bank.map(questionFingerprint) }));
    const prepared = await prepareQuestions([request], null, storage);
    expect(prepared.notice).toContain('least-recently-used');
  });
  it('accepts validated online questions and rejects repeats or malformed provider responses with explicit fallback', async () => {
    const request: QuestionRequest = { game: 'same-brain', count: 3 };
    const questions = offlineBank('same-brain').slice(0, 3);
    const storage = memory();
    const fresh = await prepareQuestions([request], async () => ({ questions }), storage);
    expect(fresh.notice).toBe('');
    expect(fresh.entries[0].deck.map(q => q.text)).toEqual(questions.map(q => q.text));
    storage.setItem('playground-question-history-v1', JSON.stringify({ 'same-brain': questions.map(questionFingerprint) }));
    const repeated = await prepareQuestions([request], async () => ({ questions }), storage);
    expect(repeated.notice).toContain('repeated a question');
    expect(repeated.entries[0].deck.some(q => questions.some(old => old.text === q.text))).toBe(false);
    const malformed = await prepareQuestions([request], async () => ({ questions: [] }), memory());
    expect(malformed.notice).toContain('incomplete deck');
    expect(malformed.entries[0].deck).toHaveLength(3);
    const failed = await prepareQuestions([request], async () => { throw new Error('Daily limit'); }, memory());
    expect(failed.notice).toContain('Daily limit');
  });
  it('surfaces corrupt or inaccessible browser history rather than pretending repeats are tracked', async () => {
    const storage = { getItem: () => '{oops' };
    const result = await prepareQuestions([{ game: 'same-page', count: 3 }], null, storage);
    expect(result.notice).not.toBe('');
    expect(result.entries[0].deck).toHaveLength(3);
    expect(() => readQuestionHistory({ getItem: () => '{"same-page":[3]}' })).toThrow('repeat tracking');
  });
  it('validates counts, option shapes, sections, difficulty, duplicates, and neutral wording', () => {
    expect(() => parseQuestionRequest({ game: 'same-page', count: 30 })).toThrow();
    expect(() => parseQuestionRequest({ game: 'same-brain', count: 3, answers: 'private' })).toThrow('Only game settings');
    expect(() => parseQuestionRequest({ game: 'same-page', count: 10, sections: ['Trust', 'Trust'] })).toThrow();
    const deck = offlineBank('same-brain').slice(0, 3);
    expect(() => validateQuestions({ game: 'same-brain', count: 3 }, { questions: [deck[0], deck[0], deck[2]] })).toThrow('repeated');
    expect(() => validateQuestions({ game: 'same-brain', count: 3 }, { questions: [{ ...deck[0], options: ['a', 'b'] }, ...deck.slice(1)] })).toThrow('options');
    expect(() => validateQuestions({ game: 'same-brain', count: 3 }, { questions: [{ ...deck[0], text: 'What would your boyfriend do?' }, ...deck.slice(1)] })).toThrow('gender-neutral');
    expect(() => validateQuestions({ game: 'same-brain', count: 3 }, { questions: [{ ...deck[0], level: 4 }, ...deck.slice(1)] })).toThrow('difficulty');
    const selected = chooseOfflineQuestions({ game: 'same-page', count: 5, sections: ['Trust'] }, []).entry.deck;
    expect(() => validateQuestions({ game: 'same-page', count: 5, sections: ['Respect'] }, { questions: selected })).toThrow('selected sections');
  });
});
