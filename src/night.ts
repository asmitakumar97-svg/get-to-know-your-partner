import { gameDefinition, isGameId, type GameId } from './catalog';
import { createGame, isChoiceGame, type SessionState } from './game';
import { createChoiceGame, optionLabels, partyRecap, partyReportText } from './party';
import { buildReflection, reflectionText } from './report';
import { buildSectionDeck, type Section } from './scenarios';
import { partyRoundCounts } from '../supabase/functions/_shared/questions';
import { analyzeParty, analyzeSamePage, analysisText, combineAnalyses, relationshipReportText, type ReportFormat } from './insights';

export type NightEntry = Pick<ReturnType<typeof createGame>, 'deck'> & { gameType: 'same-page' }
  | Pick<ReturnType<typeof createChoiceGame>, 'deck' | 'gameType'>;
export interface GameNight {
  playlist: NightEntry[];
  index: number;
  completed: SessionState[];
  finished: boolean;
}

export function buildPlaylist(ids: GameId[], count: number, selectedSections?: readonly Section[]): NightEntry[] {
  if (ids.length < 2 || ids.length > 8 || new Set(ids).size !== ids.length || !ids.every(isGameId)) {
    throw new Error('Choose two to eight different games for your playlist.');
  }
  if (!partyRoundCounts.includes(count)) throw new Error('Choose a valid number of rounds per game.');
  return ids.map(gameType => gameType === 'same-page'
    ? { gameType, deck: selectedSections ? buildSectionDeck(selectedSections) : createGame('local', [], count, 30).deck }
    : { gameType, deck: createChoiceGame(gameType, 'local', [], count, 30).deck });
}

function gameFromEntry(entry: NightEntry, mode: 'local' | 'demo', names: string[], seconds: number): SessionState {
  return entry.gameType === 'same-page'
    ? { ...createGame(mode, names, entry.deck.length, seconds), deck: entry.deck }
    : { ...createChoiceGame(entry.gameType, mode, names, entry.deck.length, seconds), deck: entry.deck };
}

export function createNight(mode: 'local' | 'demo', names: string[], ids: GameId[], count: number, seconds: number, selectedSections?: readonly Section[], preparedPlaylist?: NightEntry[]): SessionState {
  if (names.length !== 2 || names.some(name => !name.trim() || name.trim().length > 24)) throw new Error('Enter a first name for each player.');
  if (![30, 60, 120, 180].includes(seconds)) throw new Error('Choose a valid discussion time.');
  const playlist = preparedPlaylist ?? buildPlaylist(ids, count, selectedSections);
  if (playlist.length < 2 || playlist.length > 8 || new Set(ids).size !== ids.length || playlist.length !== ids.length || playlist.some((entry, i) => entry.gameType !== ids[i])) throw new Error('The prepared playlist does not match your selected games.');
  return { ...gameFromEntry(playlist[0], mode, names, seconds), night: { playlist, index: 0, completed: [], finished: false } };
}

export function advanceNight(game: SessionState, playerId: string, expectedIndex: number): SessionState {
  if (!game.night) throw new Error('This session does not have a playlist.');
  if (game.mode === 'online') throw new Error('Online playlists must advance through the room server.');
  if (!game.players.some(p => p.id === playerId && !p.left) || game.players.some(p => p.left)) throw new Error('Both players must still be in this game night.');
  if (expectedIndex < game.night.index || game.night.finished) return game;
  if (expectedIndex !== game.night.index || game.phase !== 'recap') throw new Error('Finish the current game before continuing the playlist.');
  const ready = [...new Set([...game.ready, playerId])];
  if (ready.length < 2) return { ...game, ready };
  const snapshot = { ...game, ready: [] };
  delete snapshot.night;
  const night = { ...game.night, completed: [...game.night.completed, snapshot] };
  if (night.index === night.playlist.length - 1) return { ...game, ready: [], night: { ...night, finished: true } };
  const next = gameFromEntry(night.playlist[night.index + 1], game.mode, game.players.map(p => p.name), game.discussionSeconds);
  return { ...next, players: game.players, night: { ...night, index: night.index + 1 } };
}

export function nightReflection(game: SessionState) {
  const night = game.night;
  if (!night?.finished || night.completed.length !== night.playlist.length) throw new Error('Finish your playlist together to see the combined report.');
  const summaries = night.completed.map((completed, index) => {
    if (completed.phase !== 'recap' || (completed.gameType ?? 'same-page') !== night.playlist[index].gameType
      || completed.players.length !== 2 || completed.players.some((p, i) => p.id !== game.players[i].id)) {
      throw new Error('A completed game could not be verified. Your combined report cannot be generated accurately.');
    }
    const title = gameDefinition(completed.gameType ?? 'same-page').title;
    if (!isChoiceGame(completed)) {
      const report = buildReflection(completed);
      if (report.total !== completed.deck.length) throw new Error('A completed game has missing paired answers.');
      return {
        title, total: report.total,
        analysis: analyzeSamePage(report),
        shared: report.sharedGround.map(r => `${r.scenario.title}: ${r.shared.join(' ')}`),
        discoveries: report.differentPerspectives.map(r => `${r.scenario.title}: ${r.differences.join(' ')}`),
        prompts: report.rounds.map(r => r.prompt),
      };
    }
    const recap = partyRecap(completed);
    if (recap.total + (completed.skippedRounds?.length ?? 0) !== completed.deck.length) throw new Error('A completed game has missing paired answers.');
    const sharedGame = completed.gameType === 'same-brain' || completed.gameType === 'more-likely' || completed.gameType === 'when-things-get-hard';
    return {
      title, total: recap.total,
      analysis: analyzeParty(completed, recap, completed.deck.map((_, round) => optionLabels(completed, round))),
      shared: recap.rounds.filter(r => sharedGame ? r.matched === true : r.predictionMatches.includes(true) && r.predictionMatches.every(match => match !== false))
        .map(r => `${completed.deck[r.round].title}: ${r.notes.join(' ')}`),
      discoveries: recap.rounds.filter(r => sharedGame ? r.matched === false : r.predictionMatches.includes(false))
        .map(r => `${completed.deck[r.round].title}: ${r.notes.join(' ')}`),
      prompts: recap.rounds.map(r => r.prompt),
    };
  });
  return { summaries, completed: night.completed, total: summaries.reduce((sum, item) => sum + item.total, 0), analysis: combineAnalyses(summaries) };
}

export function nightReportText(game: SessionState, format: ReportFormat = 'insights'): string {
  const report = nightReflection(game);
  if (format === 'insights') return relationshipReportText('Our game night', game.players.map(player => player.name), report.analysis, game.mode === 'demo');
  return [
    'YOUR TWO-PERSON PLAYGROUND | GAME-NIGHT REFLECTION',
    game.players.map(p => p.name).join(' & '),
    ...(game.mode === 'demo' ? ['DEMO: one partner is simulated.'] : []),
    `${report.summaries.length} games, ${report.total} completed rounds.`,
    'A reflection on selected answers, not a relationship grade, diagnosis, or compatibility prediction. Different perspectives are invitations to understand each other.',
    '', ...analysisText(report.analysis, true),
    ...report.summaries.flatMap(item => [
      '', item.title.toUpperCase(),
      'SHARED CHOICES & ACCURATE PREDICTIONS', ...item.shared,
      'DIFFERENCES & SURPRISES', ...item.discoveries,
      'KEEP TALKING', item.prompts[0],
    ]),
    '', 'YOUR COMPLETE GAME REPORTS',
    ...report.completed.map(completed => isChoiceGame(completed) ? partyReportText(completed, 'archive') : reflectionText(buildReflection(completed), 'archive')),
    '', 'YOUR CONVERSATION TO RETURN TO',
    ...(report.analysis.conversation ? [report.analysis.conversation.context, report.analysis.conversation.question] : ['There are not enough paired answers for a personalised conversation yet.']),
    '', 'Private answers and explanations. Save or share only if you both agree.',
  ].join('\n');
}
