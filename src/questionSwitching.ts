import { questionFingerprint } from '../supabase/functions/_shared/questions';
import type { ChoiceScenario } from './catalog';
import { isChoiceGame, type ChoiceGameState, type GameState, type SessionState } from './game';
import type { NightEntry } from './night';
import { legacyPageBank, offlineBank } from './offlineQuestions';
import { selectedSectionsFromDeck, type Scenario } from './scenarios';

export function canSwitchQuestion(game: SessionState): boolean {
  return game.gameType !== 'us-against-the-world' && game.phase === 'answering'
    && game.players.length === 2 && game.players.every(player => !player.left)
    && game.submitted.length === 0 && !Object.keys(game.answers[game.round] ?? {}).length;
}

export function replacementQuestions(game: ChoiceGameState): ChoiceScenario[];
export function replacementQuestions(game: GameState): Scenario[];
export function replacementQuestions(game: SessionState): Scenario[];
export function replacementQuestions(game: SessionState): Scenario[] {
  if (game.gameType === 'us-against-the-world' || !game.deck[game.round]) return [];
  const current = game.deck[game.round];
  const legacySections = !isChoiceGame(game) && selectedSectionsFromDeck(game.deck);
  const candidates = isChoiceGame(game) ? offlineBank(game.gameType)
    : (legacySections ? legacyPageBank : offlineBank('same-page')).map(question => ({
      ...question, verdictOptions: current.verdictOptions, reasonOptions: current.reasonOptions,
    }));
  const excluded = [...game.deck, ...(game.switchedQuestions ?? [])];
  const ids = new Set(excluded.map(question => question.id));
  const texts = new Set(excluded.map(questionFingerprint));
  const oneCategory = (game.gameType === 'if-i-were-you' || game.gameType === 'when-things-get-hard')
    && game.deck.every(question => question.category === current.category);
  return candidates.filter(question => {
    if (ids.has(question.id) || texts.has(questionFingerprint(question))) return false;
    if ((legacySections || oneCategory) && question.category !== current.category) return false;
    if (isChoiceGame(game) && game.gameType === 'pick-my-poison' && 'level' in question && question.level !== game.deck[game.round].level) return false;
    ids.add(question.id);
    texts.add(questionFingerprint(question));
    return true;
  });
}

export function chooseReplacement(game: ChoiceGameState): ChoiceScenario;
export function chooseReplacement(game: GameState): Scenario;
export function chooseReplacement(game: SessionState): Scenario;
export function chooseReplacement(game: SessionState): Scenario {
  const candidates = replacementQuestions(game);
  if (!candidates.length) throw new Error('No unused alternatives remain for this selection.');
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function switchQuestion(game: SessionState, playerId: string): SessionState {
  if (game.mode === 'online') throw new Error('Online questions must be switched through the room server.');
  if (!canSwitchQuestion(game) || !game.players.some(player => player.id === playerId && !player.left)) {
    throw new Error('Switch questions before either player submits an answer.');
  }
  const current = game.deck[game.round];
  const changes = {
    switchedQuestions: [...(game.switchedQuestions ?? []), { id: current.id, text: current.text }],
    revision: (game.revision ?? 0) + 1,
  };
  let next: SessionState;
  if (isChoiceGame(game)) {
    const replacement = chooseReplacement(game);
    next = { ...game, ...changes, deck: game.deck.map((question, index) => index === game.round ? replacement : question) };
  } else {
    const replacement = chooseReplacement(game);
    next = { ...game, ...changes, deck: game.deck.map((question, index) => index === game.round ? replacement : question) };
  }
  if (!next.night) return next;
  const night = next.night;
  const entry: NightEntry = isChoiceGame(next) ? { gameType: next.gameType, deck: next.deck } : { gameType: 'same-page', deck: next.deck };
  return { ...next, night: { ...night, playlist: night.playlist.map((previous, index) => index === night.index ? entry : previous) } };
}
