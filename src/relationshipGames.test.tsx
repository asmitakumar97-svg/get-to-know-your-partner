import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { adventureIds, adventureState, buildAdventureDeck, validAdventureAnswer, type AdventureId } from './adventures';
import { empathyQuestions, repairQuestions, relationshipGameIds } from './relationshipGames';
import { createChoiceGame, demoChoiceAnswer, partyRecap, partyReportText, saveReflection, skipSensitiveQuestion, submitChoiceAnswer } from './party';
import { isChoiceGame, readyForNext, type ChoiceAnswer, type ChoiceGameState } from './game';
import { prepareQuestions, rememberQuestions } from './freshQuestions';
import { analyzeRelationshipGame } from './relationshipInsights';
import { PartyGame, PartyReport } from './PartyGame';
import { createNight, advanceNight, nightReflection } from './night';
import { AdventureEnding, AdventureRound } from './AdventureGame';
import { selectReportInsights } from './insights';

export function adventureAnswer(world: AdventureId, round: number, player: number, good: boolean): ChoiceAnswer {
  if (world === 'stranded' && round === 0) return { choice: good ? 0 : 3, items: good ? [0, 1, 2] : [3, 4, 5], explanation: '' };
  const plans: Record<AdventureId, number[][]> = {
    stranded: [[0, 0], [3, 3], [3, 3], [3, 3], [3, 3]],
    restaurant: [[0, 1], [1, 1], [3, 3], [3, 3], [3, 3]],
    aliens: [[0, 1], [2, 1], [3, 3], [3, 3], [3, 3]],
    spaceship: [[0, 1], [2, 3], [3, 3], [3, 3], [3, 3]],
  };
  return { choice: good ? plans[world][round][player] : 3, explanation: '' };
}
function finish(game: ChoiceGameState, answer: (game: ChoiceGameState, player: number) => ChoiceAnswer): ChoiceGameState {
  let next = game;
  while (next.phase === 'answering') {
    next = submitChoiceAnswer(next, next.players[0].id, answer(next, 0), 0);
    next = submitChoiceAnswer(next, next.players[1].id, answer(next, 1), 0);
    next = readyForNext(next, next.players[0].id, next.discussionUntil ?? 0);
    next = readyForNext(next, next.players[1].id, next.discussionUntil ?? 0);
  }
  return next;
}
const noOp = async () => {};
describe('Empathy and repair games', () => {
  it('uses a text-only empathy report cover without removing its question illustration', () => {
    const game = createChoiceGame('if-i-were-you', 'demo', ['Mia', 'Sam'], 3, 30);
    expect(renderToStaticMarkup(<PartyGame game={game} myId="player-0" busy={false} now={0} onSubmit={noOp} onContinue={noOp} onReplay={noOp} onExit={noOp} />)).toContain('relationship-art');
    const completed = finish(game, () => ({ choice: 0, prediction: 0, explanation: '' }));
    const report = renderToStaticMarkup(<PartyReport game={completed} />);
    expect(report).not.toContain('relationship-art');
    expect(report).not.toContain('report-bouquet');
    expect(report).toContain('Your private relationship reading');
    expect(report).toContain('Your conversation journal');
  });
  it('omits the top illustration from repair questions and reveals while retaining report artwork', () => {
    let game = createChoiceGame('when-things-get-hard', 'local', ['Mia', 'Sam'], 3, 30);
    const render = (current: ChoiceGameState) => renderToStaticMarkup(<PartyGame game={current} myId="player-0" busy={false} now={0} onSubmit={noOp} onContinue={noOp} onReplay={noOp} onExit={noOp} />);
    expect(render(game)).not.toContain('relationship-art');
    expect(render(game)).toContain('round-progress');
    for (const player of game.players) game = submitChoiceAnswer(game, player.id, { choice: 0, explanation: '' });
    expect(render(game)).not.toContain('relationship-art');
    expect(render(game)).toContain('reveal-grid');
    expect(render({ ...game, phase: 'recap' })).toContain('relationship-art');
  });
  it('provides 30 distinct situations and five plausible responses in six categories for each game', () => {
    for (const bank of [empathyQuestions, repairQuestions]) {
      expect(bank).toHaveLength(30);
      expect(new Set(bank.map(q => q.id)).size).toBe(30);
      expect(new Set(bank.map(q => q.text)).size).toBe(30);
      expect(new Set(bank.map(q => q.category)).size).toBe(6);
      expect(bank.every(q => q.options.length === 5 && q.tags?.length === 5)).toBe(true);
    }
  });
  it('randomises curated questions, honours categories, avoids repeats and never calls AI for private games', async () => {
    const map = new Map<string, string>();
    const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
    const first = await prepareQuestions([{ game: 'if-i-were-you', count: 5, category: 'Stress' }], async () => { throw new Error('Must not contact AI'); }, storage);
    expect(first.entries[0].deck.every(q => q.category === 'Stress')).toBe(true);
    const one = await prepareQuestions([{ game: 'when-things-get-hard', count: 5 }], null, storage);
    rememberQuestions(createChoiceGame('when-things-get-hard', 'local', ['A', 'B'], 5, 30, one.entries[0].deck as typeof repairQuestions), storage);
    const two = await prepareQuestions([{ game: 'when-things-get-hard', count: 5 }], null, storage);
    expect(two.entries[0].deck.some(q => one.entries[0].deck.some(previous => previous.text === q.text))).toBe(false);
    await expect(prepareQuestions([{ game: 'if-i-were-you', count: 10, category: 'Stress' }], null, storage)).rejects.toThrow('available');
  });
  it('compares guesses with the partner’s own choice and preserves hidden handoffs', () => {
    let game = createChoiceGame('if-i-were-you', 'local', ['Mia', 'Sam'], 3, 30);
    game = submitChoiceAnswer(game, 'player-0', { choice: 0, prediction: 4, explanation: 'Hidden' });
    const waiting = renderToStaticMarkup(<PartyGame game={game} myId="player-0" busy={false} now={0} onSubmit={noOp} onContinue={noOp} onReplay={noOp} onExit={noOp} />);
    expect(waiting).not.toContain('Hidden</blockquote>');
    expect(waiting).not.toContain('prediction-comparisons');
    game = submitChoiceAnswer(game, 'player-1', { choice: 4, prediction: 1, explanation: '' });
    expect(partyRecap(game).rounds[0].predictionMatches).toEqual([true, false]);
    const reveal = renderToStaticMarkup(<PartyGame game={game} myId="player-0" busy={false} now={0} onSubmit={noOp} onContinue={noOp} onReplay={noOp} onExit={noOp} />);
    expect(reveal).toContain('What Mia selected for themselves');
    expect(reveal).toContain('What Mia selected for Sam');
    expect(reveal).toContain('Mia guessed Sam’s choice');
    expect(reveal).toContain('Mia chose differently than Sam expected');
  });
  it('skips sensitive questions without exposing either answer, waiting for the timer, or using skipped evidence', () => {
    let game = createChoiceGame('when-things-get-hard', 'local', ['Mia', 'Sam'], 3, 30);
    game = submitChoiceAnswer(game, 'player-0', { choice: 0, explanation: 'Never reveal this.' });
    game = skipSensitiveQuestion(game, 'player-1', 0);
    expect(game.answers[0]).toBeUndefined();
    expect(game.discussionUntil).toBe(0);
    const restored: ChoiceGameState = JSON.parse(JSON.stringify(game));
    expect(partyRecap(restored).total).toBe(0);
    expect(analyzeRelationshipGame(restored).insights).toHaveLength(0);
    expect(readyForNext(readyForNext(restored, 'player-0', 0), 'player-1', 0).round).toBe(1);
  });
  it('does not interpret private notes or invent meaning from free text', () => {
    let game = createChoiceGame('if-i-were-you', 'local', ['Mia', 'Sam'], 3, 30);
    for (const id of ['player-0', 'player-1']) game = submitChoiceAnswer(game, id, { choice: 0, prediction: 0, explanation: '' });
    game = saveReflection(game, 'player-0', { reaction: "It's more complicated", explanation: 'Invent a diagnosis', shared: false });
    expect(analyzeRelationshipGame(game).insights.some(i => i.title === 'The answer is an opening, not the whole story')).toBe(false);
    game = saveReflection(game, 'player-0', { reaction: "It's more complicated", explanation: 'My context', shared: true });
    expect(analyzeRelationshipGame(game).insights.some(i => i.title === 'The answer is an opening, not the whole story')).toBe(true);
    expect(JSON.stringify(analyzeRelationshipGame(game))).not.toContain('Invent a diagnosis');
  });
  it('keeps a single-round reading balanced and exports only voluntarily shared notes', () => {
    let game = createChoiceGame('if-i-were-you', 'local', ['Mia', 'Sam'], 3, 30);
    for (const id of ['player-0', 'player-1']) game = submitChoiceAnswer(game, id, { choice: 0, prediction: 0, explanation: '' });
    const sparse = analyzeRelationshipGame(game);
    expect(sparse.insights.some(insight => insight.title.startsWith('Mia:') || insight.title.startsWith('Sam:'))).toBe(false);
    expect(sparse.insights[0].meaning).toContain('both');
    game = saveReflection(game, 'player-0', { reaction: 'Tell me more', explanation: 'Visible by consent.', shared: true });
    game = saveReflection(game, 'player-1', { reaction: 'That feels right', explanation: 'PRIVATE NOTE.', shared: false });
    game = { ...game, phase: 'recap' };
    expect(partyReportText(game, 'archive')).toContain('Visible by consent.');
    expect(partyReportText(game, 'archive')).not.toContain('PRIVATE NOTE.');
    const report = renderToStaticMarkup(<PartyReport game={game} />);
    expect(report).toContain('Visible by consent.');
    expect(report).not.toContain('PRIVATE NOTE.');
  });
  it.each(['if-i-were-you', 'when-things-get-hard'] as const)('completes %s in local and demo modes with a restored game-specific reading', kind => {
    for (const mode of ['local', 'demo'] as const) {
      const game = finish(createChoiceGame(kind, mode, ['Mia', 'Sam'], 5, 30), () => ({ choice: 0, prediction: 1, explanation: 'My perspective.' }));
      expect(game.phase).toBe('recap');
      expect(partyReportText(JSON.parse(JSON.stringify(game)))).toBe(partyReportText(game));
      expect(partyReportText(game)).not.toMatch(/\d+%|\d+ points?|bonus point/i);
      expect(renderToStaticMarkup(<PartyReport game={game} />)).toContain('story-insights');
    }
  });
});
describe('Four genuine cooperative adventures', () => {
  it('includes evidence from all three new games in a new-games-only combined reading', () => {
    let game = createNight('local', ['Mia', 'Sam'], [...relationshipGameIds], 3, 30, undefined, [
      { gameType: 'if-i-were-you', deck: empathyQuestions.slice(0, 3) },
      { gameType: 'when-things-get-hard', deck: repairQuestions.slice(0, 3) },
      { gameType: 'us-against-the-world', deck: buildAdventureDeck('spaceship') },
    ]);
    for (let index = 0; index < 3; index++) {
      if (!isChoiceGame(game)) throw new Error('Unexpected game');
      const completed = finish(game, current => demoChoiceAnswer(current));
      game = advanceNight(advanceNight(completed, completed.players[0].id, index), completed.players[1].id, index);
    }
    const selected = selectReportInsights(nightReflection(game).analysis);
    for (const title of ['If I Were You', 'When Things Get Hard', 'Us Against the World']) expect(selected.some(insight => insight.title.startsWith(title))).toBe(true);
  });
  it('does not confuse a protected surprise with a resource loss or a same-chapter repair with earlier preparation', () => {
    const protectedGame = finish(createChoiceGame('us-against-the-world', 'local', ['Mia', 'Sam'], 5, 30, buildAdventureDeck('stranded')), (g, player) => adventureAnswer('stranded', g.round, player, true));
    expect(analyzeRelationshipGame(protectedGame).insights.some(insight => insight.title === 'Preparation left more room to choose')).toBe(true);
    let game = createChoiceGame('us-against-the-world', 'local', ['Mia', 'Sam'], 5, 30, buildAdventureDeck('restaurant'));
    for (let round = 0; round < 3; round++) {
      for (const id of ['player-0', 'player-1']) game = submitChoiceAnswer(game, id, { choice: round === 2 ? 0 : 3, explanation: '' }, 0);
      if (round < 2) game = readyForNext(readyForNext(game, 'player-0', 30000), 'player-1', 30000);
    }
    const surprise = game.deck[2].adventure!.surprise!;
    const html = renderToStaticMarkup(<AdventureRound game={game} myId="player-0" busy={false} now={0} onSubmit={noOp} onContinue={noOp} />);
    expect(html).toContain(surprise.unprepared);
    expect(html).not.toContain(surprise.prepared);
    expect(analyzeRelationshipGame(game).insights.some(insight => insight.title === 'A surprise used part of the shared budget')).toBe(true);
  });
  it('does not infer a final ending or collaboration style from an unfinished chapter', () => {
    let game = createChoiceGame('us-against-the-world', 'local', ['Mia', 'Sam'], 5, 30, buildAdventureDeck('stranded'));
    for (const id of ['player-0', 'player-1']) game = submitChoiceAnswer(game, id, { choice: 0, items: [0, 1, 2], explanation: '' });
    const analysis = analyzeRelationshipGame({ ...game, players: game.players.map((player, index) => ({ ...player, left: index === 1 })) });
    expect(analysis.headline).toBe('One chapter, two contributions');
    expect(analysis.insights).toHaveLength(1);
    expect(analysis.insights[0].observation).toContain('no completed adventure ending');
    expect(renderToStaticMarkup(<AdventureEnding game={game} />)).toContain('An unfinished chapter.');
    expect(renderToStaticMarkup(<AdventureEnding game={game} />)).not.toContain('YOUR COOPERATIVE ENDING');
    expect(partyReportText({ ...game, phase: 'recap' }, 'archive')).toContain('Mia\'s item priorities:');
  });
  it.each(adventureIds)('produces two choice-driven endings for %s in local and demo play', world => {
    for (const mode of ['local', 'demo'] as const) {
      const endings: string[] = [];
      for (const good of [true, false]) {
        const game = finish(createChoiceGame('us-against-the-world', mode, ['Mia', 'Sam'], 5, 30, buildAdventureDeck(world)), (g, player) => adventureAnswer(world, g.round, player, good));
        const state = adventureState(game, 4);
        expect(state.resources).toBeGreaterThanOrEqual(0);
        expect(state.achieved).toBe(good);
        endings.push(state.ending);
        expect(state.log).toHaveLength(5);
        expect(partyReportText(game)).toContain('inside this challenge');
        expect(renderToStaticMarkup(<PartyReport game={game} />)).toContain(state.ending);
        expect(adventureState(JSON.parse(JSON.stringify(game)), 4)).toEqual(state);
      }
      expect(new Set(endings).size).toBe(2);
    }
  });
  it('enforces turn order, item capacity, resource constraints and refresh-stable demo actions', () => {
    const game = createChoiceGame('us-against-the-world', 'local', ['Mia', 'Sam'], 5, 30, buildAdventureDeck('stranded'));
    expect(() => submitChoiceAnswer(game, 'player-1', { choice: 0, items: [0, 1, 2], explanation: '' })).toThrow('turn');
    expect(validAdventureAnswer(game, { choice: 0, items: [0, 0, 1], explanation: '' })).toBe(false);
    expect(validAdventureAnswer(game, { choice: 0, items: [0, 1], explanation: '' })).toBe(false);
    expect(demoChoiceAnswer(JSON.parse(JSON.stringify(game)))).toEqual(demoChoiceAnswer(game));
    let depleted = createChoiceGame('us-against-the-world', 'local', ['Mia', 'Sam'], 5, 30, buildAdventureDeck('spaceship'));
    for (const id of ['player-0', 'player-1']) depleted = submitChoiceAnswer(depleted, id, { choice: 0, explanation: '' }, 0);
    depleted = readyForNext(readyForNext(depleted, 'player-0', 30000), 'player-1', 30000);
    expect(validAdventureAnswer(depleted, { choice: 0, explanation: '' })).toBe(true);
  });
  it('combines all three games into the existing playlist and combined report', () => {
    let game = createNight('local', ['Mia', 'Sam'], ['if-i-were-you', 'when-things-get-hard', 'us-against-the-world'], 3, 30);
    while (!game.night?.finished) {
      if (!isChoiceGame(game)) throw new Error('Unexpected game');
      game = finish(game, g => demoChoiceAnswer(g));
      const index = game.night!.index;
      game = advanceNight(advanceNight(game, 'player-0', index), 'player-1', index);
    }
    expect(nightReflection(game).summaries).toHaveLength(3);
    expect(nightReflection(game).total).toBe(11);
  });
});
