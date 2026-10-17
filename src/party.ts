import { afterSubmission, createGame, type ChoiceAnswer, type ChoiceGameState } from './game';
import { buildDeck, gameDefinition, type ChoiceScenario, type PartyGameId } from './catalog';

export function createChoiceGame(gameType: PartyGameId, mode: 'local' | 'demo', names: string[], count: number, seconds: number, preparedDeck?: ChoiceScenario[]): ChoiceGameState {
  const base = createGame(mode, names, count, seconds);
  return { ...base, gameType, deck: preparedDeck ?? buildDeck(gameType, count), answers: {} };
}

export function isBonusRound(game: ChoiceGameState, round = game.round) {
  return game.gameType === 'same-brain' && round === game.deck.length - 1;
}
export function responderIndex(round: number) { return round % 2; }
export function optionLabels(game: ChoiceGameState, round = game.round) {
  if (game.gameType !== 'more-likely') return game.deck[round].options;
  const names = game.players.map(p => p.name);
  return new Set(names.map(name => name.trim().toLowerCase())).size === names.length
    ? names : names.map((name, i) => `${name} (player ${i + 1})`);
}

export function validChoiceAnswer(game: ChoiceGameState, answer: ChoiceAnswer, round = game.round) {
  const options = optionLabels(game, round);
  return Number.isInteger(answer.choice) && answer.choice >= 0 && answer.choice < options.length &&
    typeof answer.explanation === 'string' && answer.explanation.length <= 600 &&
    (game.gameType !== 'pick-my-poison' || (typeof answer.prediction === 'number' && Number.isInteger(answer.prediction) && answer.prediction >= 0 && answer.prediction < options.length)) &&
    (!isBonusRound(game, round) || typeof answer.matchPrediction === 'boolean');
}

export function submitChoiceAnswer(game: ChoiceGameState, playerId: string, answer: ChoiceAnswer, now = Date.now()): ChoiceGameState {
  if (!validChoiceAnswer(game, answer)) throw new Error('Choose an answer and complete any prediction before submitting.');
  if (game.phase !== 'answering' || !game.players.some(p => p.id === playerId && !p.left) || game.players.some(p => p.left)) throw new Error('This round is not accepting answers.');
  if (game.submitted.includes(playerId)) return game;
  return {
    ...afterSubmission(game, [...game.submitted, playerId], now),
    answers: { ...game.answers, [game.round]: { ...game.answers[game.round], [playerId]: answer } },
  };
}

export interface PartyRoundResult {
  round: number;
  matched: boolean;
  sharedPoint: number;
  playerPoints: [number, number];
  attempts: [number, number];
  notes: string[];
  prompt: string;
}

export function scorePartyRound(game: ChoiceGameState, round: number): PartyRoundResult | null {
  const pair = game.players.map(player => game.answers[round]?.[player.id]);
  if (game.players.length !== 2 || !pair[0] || !pair[1]) return null;
  const [first, second] = pair;
  if (!validChoiceAnswer(game, first, round) || !validChoiceAnswer(game, second, round)) throw new Error('A saved answer is invalid. This round cannot be scored accurately.');
  const labels = optionLabels(game, round);
  const matched = first.choice === second.choice;
  const playerPoints: [number, number] = [0, 0];
  const attempts: [number, number] = [0, 0];
  let sharedPoint = 0;
  let notes: string[] = [];
  let prompt = game.deck[round].prompt;
  if (game.gameType === 'same-brain' || game.gameType === 'more-likely') {
    sharedPoint = Number(matched);
    notes = [matched ? `You both chose "${labels[first.choice]}". One shared point.` : `You chose different answers. No shared point this round; neither perspective is wrong.`];
    if (isBonusRound(game, round)) {
      [first, second].forEach((answer, i) => {
        playerPoints[i] = Number(answer.matchPrediction === matched);
        attempts[i] = 1;
        notes.push(`${game.players[i].name} predicted ${answer.matchPrediction ? 'a match' : 'no match'}: ${playerPoints[i] ? '1 bonus point' : '0 bonus points'}.`);
      });
    }
    if (game.gameType === 'more-likely') prompt += ' These are your perceptions, not proof that one person has a fixed trait.';
  } else if (game.gameType === 'pick-my-poison') {
    [first, second].forEach((answer, i) => {
      if (answer.prediction === undefined) throw new Error('A saved prediction is missing.');
      const actual = i === 0 ? second.choice : first.choice;
      playerPoints[i] = Number(answer.prediction === actual);
      attempts[i] = 1;
      notes.push(`${game.players[i].name} predicted "${labels[answer.prediction]}"; ${game.players[1 - i].name} actually chose "${labels[actual]}". ${playerPoints[i]} prediction point.`);
    });
  } else {
    const responder = responderIndex(round);
    const predictor = 1 - responder;
    const actual = pair[responder].choice;
    const predicted = pair[predictor].choice;
    playerPoints[predictor] = Number(actual === predicted);
    attempts[predictor] = 1;
    notes = [
      `${game.players[responder].name} actually chose "${labels[actual]}".`,
      `${game.players[predictor].name} predicted "${labels[predicted]}": ${playerPoints[predictor]} prediction point.`,
      'The actual feeling or preference is never marked right or wrong.',
    ];
    prompt += ` Ask ${game.players[responder].name} whether "${labels[actual]}" fits in general or only in this situation.`;
  }
  return { round, matched, sharedPoint, playerPoints, attempts, notes, prompt };
}

export function partyRecap(game: ChoiceGameState) {
  const rounds = game.deck.flatMap((_, round) => {
    const result = scorePartyRound(game, round);
    return result ? [result] : [];
  });
  return {
    total: rounds.length, rounds,
    sharedPoints: rounds.reduce((sum, r) => sum + r.sharedPoint, 0),
    players: game.players.map((player, i) => ({
      ...player,
      points: rounds.reduce((sum, r) => sum + r.playerPoints[i], 0),
      attempts: rounds.reduce((sum, r) => sum + r.attempts[i], 0),
    })),
  };
}

export function demoChoiceAnswer(game: ChoiceGameState): ChoiceAnswer {
  // Independent of the human's submission: a demo must not manufacture accurate predictions.
  return {
    choice: (game.round + 1) % optionLabels(game).length,
    ...(game.gameType === 'pick-my-poison' ? { prediction: game.round % 2 } : {}),
    ...(isBonusRound(game) ? { matchPrediction: game.round % 2 === 0 } : {}),
    explanation: 'A simulated perspective for trying this game. Your real partner may choose differently.',
  };
}

export function partyReportText(game: ChoiceGameState) {
  if (game.phase !== 'recap') throw new Error('Finish the game before saving the report.');
  const recap = partyRecap(game);
  const definition = gameDefinition(game.gameType);
  return [
    `${definition.title.toUpperCase()} | YOUR LITTLE GAME-NIGHT REPORT`,
    game.players.map(p => p.name).join(' & '),
    ...(game.mode === 'demo' ? ['DEMO: one partner is simulated.'] : []),
    `${recap.total} of ${game.deck.length} rounds have two complete answers.`,
    definition.scoring,
    'Points describe this game only, not relationship compatibility or who is right.',
    ...(game.gameType === 'same-brain' || game.gameType === 'more-likely' ? [`Shared points: ${recap.sharedPoints} of ${recap.total}.`] : []),
    ...recap.players.filter(p => p.attempts > 0).map(p => `${p.name}: ${p.points} points from ${p.attempts} prediction opportunities.`),
    '', 'YOUR ANSWERS & CONVERSATIONS',
    ...recap.rounds.flatMap(result => {
      const round = result.round;
      const labels = optionLabels(game, round);
      return [
        `${round + 1}. ${game.deck[round].title}`, game.deck[round].text,
        ...game.players.flatMap((p, i) => {
          const answer = game.answers[round][p.id];
          const role = game.gameType === 'read-the-room' ? (i === responderIndex(round) ? 'actual answer' : 'prediction') : 'actual choice';
          return [
            `${p.name} (${role}): ${labels[answer.choice]}`,
            ...(answer.explanation ? [`In their words: ${answer.explanation}`] : []),
          ];
        }),
        ...result.notes, `Talk about it: ${result.prompt}`, '',
      ];
    }),
    'TAKE IT WITH YOU',
    'Share one thing that surprised you and one thing you would like to try together. Ask instead of assuming.',
    'This file contains private answers. Save or share only with both players’ agreement.',
  ].join('\n');
}
