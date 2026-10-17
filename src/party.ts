import { afterSubmission, createGame, type ChoiceAnswer, type ChoiceGameState } from './game';
import { buildDeck, gameDefinition, type ChoiceScenario, type PartyGameId } from './catalog';
import { analyzeParty, analysisText, relationshipReportText, type ReportFormat } from './insights';
import { adventureState, validAdventureAnswer } from './adventures';
import { reactionChoices, reflectionKinds, type GameReflection } from './relationshipGames';
import { compareResponses, responseLabel, validResponse } from './writtenAnswers';

export function createChoiceGame(gameType: PartyGameId, mode: 'local' | 'demo', names: string[], count: number, seconds: number, preparedDeck?: ChoiceScenario[]): ChoiceGameState {
  const base = createGame(mode, names, count, seconds);
  return { ...base, gameType, deck: preparedDeck ?? buildDeck(gameType, count), answers: {} };
}

export function isMatchPredictionRound(game: ChoiceGameState, round = game.round) {
  return game.gameType === 'same-brain' && round === game.deck.length - 1;
}
export function responderIndex(round: number) { return round % 2; }
export function optionLabels(game: ChoiceGameState, round = game.round) {
  if (game.gameType !== 'more-likely') return game.deck[round].options;
  const names = game.players.map(p => p.name);
  const playerLabels = new Set(names.map(name => name.trim().toLowerCase())).size === names.length
    ? names : names.map((name, i) => `${name} (player ${i + 1})`);
  return [...playerLabels, 'Both of us'];
}

export function validChoiceAnswer(game: ChoiceGameState, answer: ChoiceAnswer, round = game.round) {
  if (game.gameType === 'us-against-the-world') return answer.customChoice === undefined && answer.customPrediction === undefined && validAdventureAnswer({ ...game, round }, answer);
  const options = optionLabels(game, round);
  return validResponse(answer.choice, answer.customChoice, options.length) &&
    typeof answer.explanation === 'string' && answer.explanation.length <= 600 &&
    (['pick-my-poison', 'if-i-were-you'].includes(game.gameType) ? validResponse(answer.prediction, answer.customPrediction, options.length) : answer.customPrediction === undefined) &&
    (!isMatchPredictionRound(game, round) || typeof answer.matchPrediction === 'boolean');
}

export function submitChoiceAnswer(game: ChoiceGameState, playerId: string, answer: ChoiceAnswer, now = Date.now()): ChoiceGameState {
  if (!validChoiceAnswer(game, answer)) throw new Error('Choose an answer and complete any prediction before submitting.');
  if (game.phase !== 'answering' || !game.players.some(p => p.id === playerId && !p.left) || game.players.some(p => p.left)) throw new Error('This round is not accepting answers.');
  if (game.submitted.includes(playerId)) return game;
  if (game.gameType === 'us-against-the-world' && game.players[game.submitted.length]?.id !== playerId) throw new Error('Wait for your partner’s turn before committing an action.');
  return {
    ...afterSubmission(game, [...game.submitted, playerId], now),
    answers: { ...game.answers, [game.round]: { ...game.answers[game.round], [playerId]: answer } },
  };
}

export interface PartyRoundResult {
  round: number;
  matched: boolean | null;
  predictionMatches: [boolean | null, boolean | null];
  notes: string[];
  prompt: string;
}

export function comparePartyRound(game: ChoiceGameState, round: number): PartyRoundResult | null {
  if (game.skippedRounds?.includes(round)) return null;
  const pair = game.players.map(player => game.answers[round]?.[player.id]);
  if (game.players.length !== 2 || !pair[0] || !pair[1]) return null;
  const [first, second] = pair;
  if (!validChoiceAnswer(game, first, round) || !validChoiceAnswer(game, second, round)) throw new Error('A saved answer is invalid. This round cannot be compared accurately.');
  const labels = optionLabels(game, round);
  const matched = compareResponses(first.choice, second.choice);
  const predictionMatches: [boolean | null, boolean | null] = [null, null];
  let notes: string[] = [];
  let prompt = game.deck[round].prompt;
  if (game.gameType === 'same-brain' || game.gameType === 'more-likely') {
    notes = [matched === null ? 'A written response is not automatically marked as matching or different. Read your answers together.' : matched ? `You both chose "${labels[first.choice]}". What appealed to each of you?` : 'You chose different answers. Neither perspective is wrong.'];
    if (isMatchPredictionRound(game, round)) {
      [first, second].forEach((answer, i) => {
        predictionMatches[i] = matched === null ? null : answer.matchPrediction === matched;
        notes.push(`${game.players[i].name} expected ${answer.matchPrediction ? 'matching choices' : 'different choices'}.`);
      });
    }
    if (game.gameType === 'more-likely') prompt += ' These are your perceptions, not proof that one person has a fixed trait.';
  } else if (game.gameType === 'pick-my-poison' || game.gameType === 'if-i-were-you') {
    [first, second].forEach((answer, i) => {
      if (answer.prediction === undefined) throw new Error('A saved prediction is missing.');
      const actual = i === 0 ? second.choice : first.choice;
      predictionMatches[i] = compareResponses(answer.prediction, actual);
      notes.push(`${game.players[i].name} predicted "${responseLabel(labels, answer.prediction, answer.customPrediction)}"; ${game.players[1 - i].name} actually chose "${responseLabel(labels, actual, pair[1 - i].customChoice)}".`);
    });
    if (predictionMatches.includes(null)) notes.push('This written prediction or response is for discussion, not automatic comparison.');
  } else if (game.gameType === 'read-the-room') {
    const responder = responderIndex(round);
    const predictor = 1 - responder;
    const actual = pair[responder].choice;
    const predicted = pair[predictor].choice;
    predictionMatches[predictor] = compareResponses(actual, predicted);
    notes = [
      `${game.players[responder].name} actually chose "${responseLabel(labels, actual, pair[responder].customChoice)}".`,
      `${game.players[predictor].name} predicted "${responseLabel(labels, predicted, pair[predictor].customChoice)}".`,
      'The actual feeling or preference is never marked right or wrong.',
    ];
    prompt += ` Ask ${game.players[responder].name} whether their response fits in general or only in this situation.${matched === null ? ' Written responses are not automatically compared.' : ''}`;
  } else {
    notes = game.players.map((player, i) => `${player.name} selected "${responseLabel(labels, pair[i].choice, pair[i].customChoice)}".`);
  }
  return { round, matched, predictionMatches, notes, prompt };
}

export function partyRecap(game: ChoiceGameState) {
  const rounds = game.deck.flatMap((_, round) => {
    const result = comparePartyRound(game, round);
    return result ? [result] : [];
  });
  return {
    total: rounds.length, rounds,
    players: game.players.map((player, i) => ({
      ...player,
      matchingPredictions: rounds.filter(r => r.predictionMatches[i] === true).length,
      predictionCount: rounds.filter(r => r.predictionMatches[i] !== null).length,
    })),
  };
}

export function demoChoiceAnswer(game: ChoiceGameState): ChoiceAnswer {
  if (game.gameType === 'us-against-the-world') {
    const scene = game.deck[game.round].adventure;
    if (!scene) throw new Error('The adventure rules are missing.');
    const state = adventureState(game, game.round, false);
    const choice = scene.actions.findIndex(a => a.cost <= Math.floor(state.resources / 2) && (!a.requires || state.flags.includes(a.requires)));
    return { choice: scene.kit ? 1 : choice, ...(scene.kit ? { items: [1, 2, 0] } : {}), explanation: 'A simulated teammate action.' };
  }
  // Independent of the human's submission: a demo must not manufacture accurate predictions.
  return {
    choice: (game.round + 1) % optionLabels(game).length,
    ...(['pick-my-poison', 'if-i-were-you'].includes(game.gameType) ? { prediction: game.round % optionLabels(game).length } : {}),
    ...(isMatchPredictionRound(game) ? { matchPrediction: game.round % 2 === 0 } : {}),
    explanation: 'A simulated perspective for trying this game. Your real partner may choose differently.',
  };
}

export function skipSensitiveQuestion(game: ChoiceGameState, playerId: string, now = Date.now()): ChoiceGameState {
  if (game.gameType !== 'when-things-get-hard' || game.phase !== 'answering' || game.players.some(p => p.left) || !game.players.some(p => p.id === playerId)) throw new Error('This question cannot be skipped right now.');
  const answers = { ...game.answers };
  delete answers[game.round];
  return { ...game, answers, skippedRounds: [...new Set([...(game.skippedRounds ?? []), game.round])], phase: 'discussion', submitted: [], ready: [], discussionUntil: now };
}
export function saveReflection(game: ChoiceGameState, playerId: string, reflection: GameReflection): ChoiceGameState {
  if (!['if-i-were-you', 'when-things-get-hard', 'us-against-the-world'].includes(game.gameType) || game.phase !== 'discussion' || game.skippedRounds?.includes(game.round) || !game.players.some(p => p.id === playerId && !p.left)) throw new Error('Reflections are available after a revealed round.');
  if (typeof reflection.explanation !== 'string' || reflection.explanation.length > 600 || typeof reflection.shared !== 'boolean'
    || (reflection.reaction !== undefined && !reactionChoices.includes(reflection.reaction))
    || (reflection.kind !== undefined && !reflectionKinds.includes(reflection.kind))) throw new Error('Choose a valid optional reflection and keep it under 600 characters.');
  return { ...game, reflections: { ...game.reflections, [game.round]: { ...game.reflections?.[game.round], [playerId]: reflection } } };
}

export function partyReportText(game: ChoiceGameState, format: ReportFormat = 'insights') {
  if (game.phase !== 'recap') throw new Error('Finish the game before saving the report.');
  const recap = partyRecap(game);
  const definition = gameDefinition(game.gameType);
  const analysis = analyzeParty(game, recap, game.deck.map((_, round) => optionLabels(game, round)));
  if (format === 'insights') return relationshipReportText(definition.title, game.players.map(player => player.name), analysis, game.mode === 'demo');
  return [
    `${definition.title.toUpperCase()} | YOUR LITTLE GAME-NIGHT REPORT`,
    game.players.map(p => p.name).join(' & '),
    ...(game.mode === 'demo' ? ['DEMO: one partner is simulated.'] : []),
    `${recap.total} of ${game.deck.length} rounds have two complete answers.`,
    definition.reflection,
    'These answers are an invitation to understand each other, not relationship compatibility or a judgment about who is right.',
    '', ...analysisText(analysis, true),
    '', 'YOUR ANSWERS & CONVERSATIONS',
    ...recap.rounds.flatMap(result => {
      const round = result.round;
      const labels = optionLabels(game, round);
      return [
        `${round + 1}. ${game.deck[round].title}`, game.deck[round].text,
        ...game.players.flatMap((p, i) => {
          const answer = game.answers[round][p.id];
          const role = game.gameType === 'us-against-the-world' ? 'contribution' : game.gameType === 'read-the-room' && i !== responderIndex(round) ? `selected for ${game.players[1 - i].name}` : 'selected for themselves';
          return [
            `${p.name} (${role}): ${responseLabel(labels, answer.choice, answer.customChoice)}`,
            ...(answer.prediction !== undefined ? [`What ${p.name} selected for ${game.players[1 - i].name}: ${responseLabel(labels, answer.prediction, answer.customPrediction)}`] : []),
            ...(answer.items ? [`${p.name}'s item priorities: ${answer.items.map(index => labels[index]).join(', ')}`] : []),
            ...(game.reflections?.[round]?.[p.id]?.shared ? [`Shared reflection: ${game.reflections[round][p.id].reaction ?? game.reflections[round][p.id].kind ?? ''}. ${game.reflections[round][p.id].explanation}`] : []),
            ...(answer.explanation ? [`In their words: ${answer.explanation}`] : []),
          ];
        }),
        ...result.notes, `Talk about it: ${result.prompt}`, '',
      ];
    }),
    'YOUR CONVERSATION TO RETURN TO',
    ...(analysis.conversation ? [analysis.conversation.context, analysis.conversation.question] : ['There are not enough paired answers for a personalised conversation yet.']),
    'This file contains private answers. Save or share only with both players’ agreement.',
  ].join('\n');
}
