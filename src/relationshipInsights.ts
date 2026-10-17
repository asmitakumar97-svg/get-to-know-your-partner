import type { ChoiceGameState } from './game';
import type { RelationshipAnalysis, RelationshipInsight, InsightEvidence } from './insights';
import { adventureState } from './adventures';
import { hasWrittenChoiceAnswer, responseLabel } from './writtenAnswers';
import { includeWrittenPerspectives } from './writtenAnalysis';

export function analyzeRelationshipGame(game: ChoiceGameState): RelationshipAnalysis {
  const rounds = game.deck.map((_, i) => i).filter(i => !game.skippedRounds?.includes(i) && game.players.every(p => game.answers[i]?.[p.id]));
  const written = game.gameType === 'us-against-the-world' ? [] : rounds.filter(i => game.players.some(player => hasWrittenChoiceAnswer(game.answers[i][player.id])));
  if (written.length) {
    const structured = rounds.filter(i => !written.includes(i));
    return includeWrittenPerspectives(analyzeRelationshipGame({ ...game, answers: Object.fromEntries(structured.map(i => [i, game.answers[i]])) }), written.map(i => ({
      title: game.deck[i].title, question: game.deck[i].text,
      detail: game.players.map(player => {
        const answer = game.answers[i][player.id];
        return `${player.name} selected for themselves: ${responseLabel(game.deck[i].options, answer.choice, answer.customChoice)}${answer.prediction !== undefined ? `; selected for their partner: ${responseLabel(game.deck[i].options, answer.prediction, answer.customPrediction)}` : ''}`;
      }).join('; '),
    })), rounds.length, structured.length, game.gameType === 'if-i-were-you' ? 'If I Were You' : 'When Things Get Hard');
  }
  const evidence = (selected: number[]): InsightEvidence[] => selected.slice(0, 3).map(i => ({
    title: game.deck[i].title, question: game.deck[i].text,
    detail: game.players.map(p => {
      const answer = game.answers[i][p.id];
      return `${p.name} selected for themselves: ${game.deck[i].options[answer.choice]}${answer.prediction !== undefined ? `; selected for their partner: ${game.deck[i].options[answer.prediction]}` : ''}${answer.items ? `; item priorities: ${answer.items.map(item => game.deck[i].options[item]).join(', ')}` : ''}`;
    }).join('. '),
  }));
  const insights: RelationshipInsight[] = [];
  const [first, second] = game.players;
  const scope = `${rounds.length} revealed, non-skipped situations. These are selected responses within a game, not verified real-life behaviour, a diagnosis, or a prediction. Private notes are excluded from this analysis.`;
  const result: RelationshipAnalysis = { context: game.gameType === 'if-i-were-you' ? 'empathy' : game.gameType === 'when-things-get-hard' ? 'repair' : 'cooperation', headline: 'A smaller observation is enough', summary: 'Use these choices to ask, rather than assume.', scope, insights, players: [], signals: [], alignments: [], differences: [], alignmentNote: '', measurements: [], conversation: null };
  if (!rounds.length) return { ...result, headline: 'Space to leave things unsaid', summary: 'No revealed paired answers support a reading. Skipping is a valid choice.' };
  if (game.gameType === 'us-against-the-world') {
    result.scope = `${rounds.length} completed chapters inside this challenge. These recorded decisions do not establish real-life communication, information sharing, personality, or relationship compatibility. Private notes are excluded.`;
    const state = adventureState(game, game.deck.length - 1);
    const finished = state.log.length === game.deck.length;
    if (rounds.length === 1) {
      result.headline = 'One chapter, two contributions';
      insights.push({
        title: 'One chapter is a beginning, not a collaboration style',
        pattern: 'Both partners committed a contribution in one completed chapter.',
        observation: 'There is no completed adventure ending or repeated decision pattern to interpret.',
        meaning: 'These actions show only what each person chose in this chapter. They cannot establish how you shared clues, negotiated priorities, or would respond to a later surprise.',
        nextStep: 'Each name the piece of information that mattered to your own contribution, then ask what mattered to the other person.',
        evidence: evidence(rounds),
      });
      result.conversation = { context: 'Only one paired chapter is available.', question: 'What information did each of us use, and what did we not yet know about the other person’s plan?', evidence: evidence(rounds) };
      return result;
    }
    const divided = rounds.filter(i => JSON.stringify(game.answers[i][first.id].items ?? [game.answers[i][first.id].choice]) !== JSON.stringify(game.answers[i][second.id].items ?? [game.answers[i][second.id].choice]));
    const repeated = rounds.filter(i => !divided.includes(i));
    const events = state.log.filter(entry => !!entry.event);
    const changed = events.filter(entry => adventureState(game, entry.round - 1).resources > adventureState(game, entry.round, false).resources).map(entry => entry.round);
    const prepared = events.filter(entry => {
      const surprise = game.deck[entry.round].adventure?.surprise;
      return surprise && adventureState(game, entry.round, false).flags.includes(surprise.unless);
    }).map(entry => entry.round);
    insights.push({
      title: divided.length >= 2 ? 'Two contributions can widen the plan' : repeated.length >= 2 ? 'A shared focus can leave another job waiting' : 'Overlap and difference can belong in the same plan',
      pattern: divided.length >= 2 ? 'You repeatedly committed to different actions within the same chapter.' : repeated.length >= 2 ? 'Several chapters brought your attention to the same action or item.' : 'Your contributions overlapped in one chapter and differed in another; neither forms a repeated pattern yet.',
      observation: 'This describes the committed actions, not the conversation that produced them.',
      meaning: divided.length >= 2 ? `${first.name} and ${second.name} contributed different actions in these chapters. That can create room to cover more than one need, but the record cannot show whether this came from negotiation, coincidence, or a shared plan. The useful question is which contributions actually worked together.`
        : 'Choosing the same action can reinforce a priority or duplicate work. Look at the shared checklist before deciding which happened here; neither repetition nor difference is automatically the better strategy.',
      nextStep: 'Before the next chapter, name the job each person is taking and the need that would otherwise be left uncovered.',
      evidence: evidence(divided.length >= 2 ? divided : repeated.length ? repeated : rounds),
    });
    insights.push({
      title: changed.length ? 'A surprise used part of the shared budget' : prepared.length ? 'Preparation left more room to choose' : 'Later decisions inherited earlier choices',
      pattern: changed.length ? 'A surprise reduced your available resources before you committed later actions.' : prepared.length ? 'An earlier preparation avoided the surprise’s additional resource cost.' : 'Later actions were made with the resources left by earlier decisions.',
      observation: events.map(entry => entry.event).join(' ') || 'Resources carried forward across the adventure.',
      meaning: 'The available budget followed from your recorded spending, preparation, and the adventure’s rules. The record shows what remained and what you chose next; it does not establish how flexible either person is in real life or whether you discussed a change. Compare your intended plan with the options you could still afford.',
      nextStep: 'Ask which new fact mattered most, and whether either person wanted to revisit the original plan.',
      evidence: evidence([...new Set([...changed, ...prepared].flatMap(i => [Math.max(0, i - 1), i]).concat(rounds.slice(-2)))]),
    });
    insights.push({
      title: finished ? 'Your ending belongs to the combination' : 'An unfinished story is not a failed partnership',
      pattern: !finished ? 'The adventure stopped before every chapter had paired contributions.' : state.achieved ? 'Your combined actions secured the adventure’s shared checklist.' : 'Your combined actions led to a quieter alternative ending rather than the full checklist.',
      observation: finished ? `The resulting story ending was "${state.ending}".` : 'No completed adventure ending is inferred.',
      meaning: `${finished ? 'This ending follows from the recorded kit, actions, and resource rules. It is a cooperative outcome' : 'The completed chapters record joint contributions, not a final outcome'}, not evidence that either partner is better at leading or following. The action record cannot establish who shared information or how a compromise was reached; those are questions for both of you to answer.`,
      nextStep: 'Name one contribution from each person that affected the story, then one decision you would try differently on a replay.',
      evidence: evidence(rounds.slice(-3)),
    });
    result.headline = finished ? state.ending : 'An unfinished adventure';
    result.conversation = { context: 'Only behaviour recorded inside this challenge is considered.', question: changed.length ? 'When the shared budget shrank, which information from each person would have been useful to revisit together?' : prepared.length ? 'Which early preparation mattered most to this ending, and what did each person know when choosing it?' : 'Looking at the resources you kept, what would each person want to try differently on a replay?', evidence: evidence(rounds.slice(-2)) };
    return result;
  }
  const meanings: Record<string, [string, string]> = {
    listening: ['being heard before being helped', 'Ask whether listening alone is enough before moving into advice.'],
    solutions: ['a useful next step', 'Check whether practical help is wanted now, rather than assuming it will feel supportive.'],
    space: ['room to settle', 'Pair time apart with a clear, freely agreed check-in rather than assuming silence means distance.'],
    affection: ['a gesture of closeness', 'Ask which gestures feel welcome in that moment; a game selection is not ongoing consent.'],
    reassurance: ['a clear sign that the connection is okay', 'Make reassurance specific without requiring agreement on the issue.'],
    pause: ['a pause with a way back', 'Agree on a reconnection time that leaves room for both settling and certainty.'],
    talk: ['conversation while the moment is fresh', 'Check that both people have enough capacity to listen before continuing.'],
    impact: ['acknowledging how something landed', 'Separate understanding the impact from deciding whose intentions were better.'],
    'practical-change': ['a concrete change for next time', 'Name a manageable change, and also check whether anything still needs to be acknowledged.'],
    recognition: ['having effort noticed', 'Ask what specific acknowledgement would feel meaningful, rather than assuming bigger is better.'],
    reconnect: ['knowing when you will reconnect', 'Make the return to connection explicit while leaving the pause genuinely restful.'],
  };
  for (const player of game.players) {
    const counts = new Map<string, number[]>();
    for (const i of rounds) {
      const tag = game.deck[i].tags?.[game.answers[i][player.id].choice];
      if (tag) counts.set(tag, [...(counts.get(tag) ?? []), i]);
    }
    const dominant = [...counts.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!dominant || dominant[1].length < 2) continue;
    const [tag, selected] = dominant;
    const description = meanings[tag] ?? [game.deck[selected[0]].options[game.answers[selected[0]][player.id].choice].toLowerCase(), 'Ask which part of this response mattered and what could make a different response fit.'];
    insights.push({
      title: `${player.name}: ${description[0]}`,
      pattern: `${player.name} selected responses centred on ${description[0]}${selected.length > 1 ? ' in different situations' : ' in this situation'}.`,
      observation: selected.length > 1 ? 'A repeated selection across the supporting situations.' : 'One selected response, not an established pattern.',
      meaning: game.gameType === 'when-things-get-hard'
        ? `These choices suggest a response ${player.name} would like to explore in difficult moments, not a fixed conflict style. The game cannot establish whether it happens regularly, whether it works for the other person, or whether it is easier to imagine than to do. Ask what it makes possible and what the other person would need alongside it.`
        : `In these examples, ${player.name}'s selected form of care gives you a more specific starting point than simply trying harder to be helpful. It does not establish a permanent emotional need. Compare what makes this support useful here with the circumstances in which another response might fit better.`,
      nextStep: description[1], evidence: evidence(selected),
    });
    result.players.push({ id: player.id, name: player.name, observations: [`Selected responses centred on ${description[0]} in different situations.`], nextStep: description[1], evidence: evidence(selected) });
  }
  if (!insights.length) insights.push({
    title: 'A small glimpse, not a fixed pattern',
    pattern: 'These situations brought both partners’ selected responses into view without a repeated support or repair preference.',
    observation: 'There is not enough repeated evidence to assign either person a recurring preference.',
    meaning: 'The useful starting point is the difference between the offered words and what each person meant by choosing them. Let both explain only what they want to share; one response cannot establish how either partner usually feels or behaves.',
    nextStep: 'Each name one detail that would change your own response before interpreting the other person’s answer.',
    evidence: evidence(rounds),
  });
  if (game.gameType === 'if-i-were-you') {
    const unexpected = rounds.filter(i => game.players.some((p, n) => game.answers[i][p.id].prediction !== game.answers[i][game.players[1 - n].id].choice));
    const aligned = rounds.filter(i => !unexpected.includes(i));
    insights.push({
      title: unexpected.length ? 'Care may need a translation, not more effort' : 'Familiarity is a starting point, not a standing instruction',
      pattern: unexpected.length ? 'Some guesses about support differed from what the intended recipient selected for themselves.' : 'Your guesses anticipated the support options your partner selected here.',
      observation: 'Each guess is compared with the other person’s own answer, not with the predictor’s preference.',
      meaning: unexpected.length ? 'An unexpected preference can reveal a gap between the support someone imagines offering and the support the other person would choose. This does not reveal effort, attention, or motives. Let the recipient explain the missing detail rather than treating a guess as the final interpretation.'
        : 'These examples give you an opening to ask what made the choice recognisable. They do not show whether the reasons were understood, and they do not remove the need to ask again when circumstances change.',
      nextStep: 'Try asking “What would care feel like right now: listening, ideas, company, or space?” and allow the answer to change.',
      evidence: evidence(unexpected.length ? unexpected : aligned),
    });
  } else {
    const different = rounds.filter(i => game.answers[i][first.id].choice !== game.answers[i][second.id].choice);
    insights.push({
      title: different.length ? 'A different first move need not mean a different goal' : 'The same repair word can carry different expectations',
      pattern: different.length ? 'You selected different first responses to some difficult moments.' : 'You selected the same first responses in these situations.',
      observation: 'These are responses chosen in hypothetical situations, not evidence of a real disagreement.',
      meaning: different.length ? 'One response may make another possible: a pause can create room for listening, and reassurance can make a pause easier to accept. These choices do not establish the sequence you actually use. Explore how to combine the selected approaches rather than deciding which person should abandon theirs.'
        : 'Agreement on a first step does not show that you mean the same duration, wording, or kind of follow-through. Make those details explicit before treating the shared answer as a settled agreement.',
      nextStep: 'Complete this together: “If we need a pause, we will reconnect by ___, and a helpful first sentence would be ___.”',
      evidence: evidence(different.length ? different : rounds),
    });
  }
  const qualified = rounds.filter(i => Object.values(game.reflections?.[i] ?? {}).some(note => note.shared && (note.reaction === "It's more complicated" || note.kind === 'This is what I wish would happen')));
  if (qualified.length) insights.push({
    title: 'The answer is an opening, not the whole story',
    pattern: 'A voluntarily shared reflection qualified an answer or distinguished a wish from what usually happens.',
    observation: 'Only reflections explicitly shared with the partner are included; private notes are not interpreted.',
    meaning: 'The selected option should not override this qualification. A wish can be useful planning information without being a description of current behaviour. Let the person who added context decide what they want to make more specific.',
    nextStep: 'Ask which small part of the desired response would feel possible to try, without requiring further disclosure.',
    evidence: evidence(qualified),
  });
  result.headline = game.gameType === 'if-i-were-you' ? 'Care, from the other side' : 'Different needs, a shared way back';
  result.conversation = { context: 'An invitation based on your revealed selections, not an instruction.', question: game.gameType === 'if-i-were-you' ? 'When I want to help, how could I check what would actually feel supportive to you before choosing the form of care?' : 'What could we agree in a calm moment that would leave room for both of our first responses when a disagreement feels difficult?', evidence: evidence(rounds.slice(0, 2)) };
  return result;
}
