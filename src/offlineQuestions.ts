import { gameDefinition, partyDecks, type ChoiceScenario, type GameId, type PartyGameId } from './catalog';
import { scenarios, type Scenario } from './scenarios';
import { extraPage, extraPartyDecks } from './offlineExtras';
import { samePageLibrary } from './samePageLibrary';
import { isRelationshipGame } from './relationshipGames';

export const legacyPageBank = [...scenarios, ...extraPage];

export function offlineBank(game: 'same-page'): Scenario[];
export function offlineBank(game: PartyGameId): ChoiceScenario[];
export function offlineBank(game: GameId): Scenario[];
export function offlineBank(game: GameId): Scenario[] {
  return game === 'same-page' ? [...samePageLibrary] : isRelationshipGame(game) ? [...partyDecks[game]] : [...partyDecks[game], ...extraPartyDecks[game]].map(question => ({ ...question, category: gameDefinition(game).category }));
}
