import { emotions, factors, scenarioFactors, scenarioVerdicts, type ChoiceGameState } from './game';
import { samePageReasons } from '../supabase/functions/_shared/questions';
import type { CompatibilityReflection, Frequency, ReportRound } from './report';
import type { partyRecap } from './party';
import { isRelationshipGame } from './relationshipGames';
import { analyzeRelationshipGame } from './relationshipInsights';
import { hasWrittenChoiceAnswer, hasWrittenPageAnswer, responseLabel } from './writtenAnswers';
import { includeWrittenPerspectives } from './writtenAnalysis';

export interface InsightEvidence { title: string; detail: string; question?: string }
export interface ConversationStarter { question: string; context: string; evidence: InsightEvidence[] }
export interface ReportMeasurement { label: string; numerator: number; denominator: number }
interface EvidenceSections {
  alignments: InsightEvidence[];
  differences: InsightEvidence[];
  alignmentNote: string;
  measurements: ReportMeasurement[];
  conversation: ConversationStarter | null;
}
export interface RelationshipInsight {
  title: string;
  pattern: string;
  observation: string;
  meaning: string;
  nextStep: string;
  evidence: InsightEvidence[];
}
export interface PlayerInsight {
  id: string;
  name: string;
  observations: string[];
  nextStep: string;
  evidence: InsightEvidence[];
}
export interface AnalysisSignal { kind: 'preferences' | 'perceptions' | 'prediction' | 'verdict' | 'emotion' | 'priorities'; matched: number; total: number }
export interface RelationshipAnalysis extends EvidenceSections {
  context?: 'empathy' | 'repair' | 'cooperation';
  headline: string;
  summary: string;
  scope: string;
  insights: RelationshipInsight[];
  players: PlayerInsight[];
  signals: AnalysisSignal[];
}

const scopeFor = (total: number) => total === 0
  ? 'There are no paired answers to analyze yet.'
  : total < 5 ? `Based on ${total} paired rounds: a small snapshot, not enough to establish a recurring relationship pattern.`
    : `Based on ${total} paired rounds in this session. These interpretations describe selected responses, not fixed personalities, real-life conduct, or overall compatibility.`;
const leading = (items: Frequency[]) => items.length ? items.filter(item => item.count === items[0].count) : [];
const labels = (items: Frequency[]) => leading(items).map(item => `"${item.label}"`).join(' and ');
const roundCount = (count: number) => `${count} ${count === 1 ? 'round' : 'rounds'}`;
const noEvidence: EvidenceSections = { alignments: [], differences: [], alignmentNote: 'No paired answers to compare yet.', measurements: [], conversation: null };
const reasonConcept = (label: string) => {
  const index = samePageReasons.findIndex(reason => reason.label === label);
  const resolved = index >= 0 ? index : factors.findIndex(factor => factor === label);
  return ['the behaviour itself', 'intention and context', 'openness', 'prior agreements', 'how feelings are acknowledged', 'the effect on the relationship'][resolved] ?? label;
};
const pageEvidence = (report: CompatibilityReflection, rounds: ReportRound[], axis: 'factor' | 'emotion' | 'verdict'): InsightEvidence[] =>
  rounds.slice(0, 3).map(round => ({
    title: round.scenario.title,
    question: round.scenario.text,
    detail: report.players.map((player, i) => `${player.name}: ${(axis === 'factor' ? scenarioFactors(round.scenario) : axis === 'emotion' ? emotions : scenarioVerdicts(round.scenario))[round.answers[i][axis]]}`).join('; '),
  }));

export function analyzeSamePage(report: CompatibilityReflection): RelationshipAnalysis {
  if (report.structured) {
    const written = report.rounds.filter(round => round.answers.some(hasWrittenPageAnswer));
    return includeWrittenPerspectives(analyzeSamePage(report.structured), written.map(round => ({
      title: round.scenario.title, question: round.scenario.text,
      detail: report.players.map((player, i) => {
        const answer = round.answers[i];
        return `${player.name}: ${responseLabel(scenarioVerdicts(round.scenario), answer.verdict, answer.customVerdict)}; ${responseLabel(emotions, answer.emotion, answer.customEmotion)}; ${responseLabel(scenarioFactors(round.scenario), answer.factor, answer.customFactor)}`;
      }).join('; '),
    })), report.total, report.structured.total, 'Same Page?');
  }
  const { total, counts } = report;
  const signals: AnalysisSignal[] = [
    { kind: 'verdict', matched: counts.verdict, total },
    { kind: 'emotion', matched: counts.emotion, total },
    { kind: 'priorities', matched: counts.values, total },
  ];
  if (!total) return { ...noEvidence, headline: 'Not enough shared evidence yet', summary: 'Complete some rounds together before drawing interpretations.', scope: scopeFor(0), insights: [], players: [], signals };
  const roundExample = (round: ReportRound, detail: string): InsightEvidence => ({
    title: `Q${round.index + 1} · ${round.scenario.title}`, question: round.scenario.text, detail,
  });
  const chosen = report.sameTakeDifferentFeeling[0] ?? report.differentPerspectives[0] ?? report.rounds[0];
  const conversationAxis = chosen.answers[0].emotion !== chosen.answers[1].emotion ? 'emotion'
    : chosen.answers[0].factor !== chosen.answers[1].factor ? 'factor' : 'verdict';
  const conversationLabels = conversationAxis === 'emotion' ? emotions
    : conversationAxis === 'factor' ? scenarioFactors(chosen.scenario) : scenarioVerdicts(chosen.scenario);
  const [firstChoice, secondChoice] = chosen.answers.map(answer => conversationLabels[answer[conversationAxis]]);
  const sections: EvidenceSections = {
    alignments: report.sharedGround.slice(0, 3).map(round => roundExample(round, round.shared.join(' '))),
    differences: report.differentPerspectives.slice(0, 3).map(round => roundExample(round, round.differences.join(' '))),
    alignmentNote: 'Verdicts, feelings, and reasons are separate. Sharing one does not mean sharing all three.',
    measurements: [
      { label: 'Same take', numerator: counts.verdict, denominator: total },
      { label: 'Same feeling', numerator: counts.emotion, denominator: total },
      { label: 'Same main reason', numerator: counts.values, denominator: total },
    ],
    conversation: {
      question: firstChoice === secondChoice
        ? `You both chose "${firstChoice}". What does that answer mean to each of you in this situation, and could your reasons still differ?`
        : `What shaped your choices of "${firstChoice}" and "${secondChoice}" in this situation, and what context would help you understand each other?`,
      context: `From Q${chosen.index + 1}: ${chosen.scenario.title}. ${chosen.differences.length ? 'Your selected perspectives differed here.' : 'Your selected answers overlapped here; your reasons may still differ.'}`,
      evidence: [roundExample(chosen, [...chosen.shared, ...chosen.differences].join(' '))],
    },
  };
  const axes = [{ name: 'interpretations', count: counts.verdict }, { name: 'feelings', count: counts.emotion }, { name: 'main factors', count: counts.values }];
  const max = Math.max(...axes.map(axis => axis.count));
  const leaders = axes.filter(axis => axis.count === max);
  const headline = leaders.length === 3 ? max === total ? 'Shared answers, with room for different reasons' : 'Your similarities and differences span all three threads'
    : `Your clearest shared ground: ${leaders.map(axis => axis.name).join(' and ')}`;
  const summary = `${report.players.map(player => player.name).join(' and ')} shared ${counts.verdict} of ${total} verdicts, ${counts.emotion} feelings, and ${counts.values} main factors. ${
    counts.verdict > counts.emotion ? 'Your interpretations matched more often than your feelings. Understanding an action and feeling comfortable with it are separate things for you in these situations.'
      : counts.emotion > counts.verdict ? 'Your feelings matched more often than your interpretations. You can sometimes relate to the experience even when you describe the action differently.'
        : counts.values > counts.verdict ? 'Your selected priorities matched more often than your verdicts. Some different conclusions may be about how you apply a shared concern, rather than different priorities.'
          : max === total ? 'This gives you common language for these situations; it does not establish that your reasons or real-life boundaries are identical.'
            : 'There is no single overall alignment result here. The useful distinction is which feelings, interpretations, and priorities matched in each situation.'}`;
  const insights: RelationshipInsight[] = [];
  const feelingGap = report.sameTakeDifferentFeeling;
  if (feelingGap.length) insights.push({
    title: 'Agreement does not always mean the same emotional experience',
    pattern: 'In these situations, a shared judgment did not always come with a shared feeling.',
    observation: `You agreed on the verdict but selected different feelings in ${feelingGap.length} of ${total} rounds.`,
    meaning: 'A conversation could seem settled once you agree on whether an action is okay, while something emotionally important remains unexplored. The useful distinction may be between reaching a decision and feeling heard. These answers cannot tell us whether either of you overlooks that distinction in real life, but they suggest a place to slow down together.',
    nextStep: 'After agreeing on a boundary, each finish: “Even if we agree about the action, I would feel… and I would like…”',
    evidence: pageEvidence(report, feelingGap, 'emotion'),
  });
  const commonPriority = report.rounds.filter(round => round.matches.values && !round.matches.verdict);
  if (commonPriority.length) insights.push({
    title: 'A shared priority can lead to different conclusions',
    pattern: 'Some different judgments grew out of the same selected concern, rather than opposing priorities.',
    observation: `In ${commonPriority.length} rounds you chose the same main factor but different verdicts.`,
    meaning: 'You may be protecting a similar principle while imagining different contexts, consequences, or thresholds. If this also happens outside the game, debating whose values are better could miss the actual difference: what each person believes the shared principle asks of you in that moment. The answers do not establish an underlying values conflict.',
    nextStep: 'Take one example and describe what would need to change for the situation to feel acceptable to each of you.',
    evidence: pageEvidence(report, commonPriority, 'factor'),
  });
  const differentPriorities = report.rounds.filter(round => !round.matches.values);
  const repeatedFocus = differentPriorities.find(round => new Set(differentPriorities.filter(other =>
    scenarioFactors(other.scenario)[other.answers[0].factor] === scenarioFactors(round.scenario)[round.answers[0].factor]
    && scenarioFactors(other.scenario)[other.answers[1].factor] === scenarioFactors(round.scenario)[round.answers[1].factor]).map(other => other.scenario.text)).size >= 2);
  if (differentPriorities.length) insights.push({
    title: 'You may be answering different parts of the same situation',
    pattern: repeatedFocus
      ? `Across different situations, ${report.players[0].name}'s reasoning returned to ${reasonConcept(scenarioFactors(repeatedFocus.scenario)[repeatedFocus.answers[0].factor])}, while ${report.players[1].name}'s returned to ${reasonConcept(scenarioFactors(repeatedFocus.scenario)[repeatedFocus.answers[1].factor])}.`
      : 'Your reasons brought different parts of the situation into focus, even when you were considering the same event.',
    observation: `Your main factors differed in ${differentPriorities.length} of ${total} rounds.`,
    meaning: 'One explanation can feel relevant to its speaker without addressing the concern their partner is weighing. That could create a misunderstanding about whether someone is listening, when the conversation is actually moving between different questions. This is a possibility to check together, not evidence that either of you dismisses the other. Different selected reasons also do not mean either person ignores the remaining factors.',
    nextStep: 'Build one agreement that addresses both selected factors: what happens, what gets shared, and what you agree in advance.',
    evidence: pageEvidence(report, repeatedFocus ? differentPriorities.filter(round =>
      scenarioFactors(round.scenario)[round.answers[0].factor] === scenarioFactors(repeatedFocus.scenario)[repeatedFocus.answers[0].factor]
      && scenarioFactors(round.scenario)[round.answers[1].factor] === scenarioFactors(repeatedFocus.scenario)[repeatedFocus.answers[1].factor]) : differentPriorities, 'factor'),
  });
  const allShared = report.rounds.filter(round => round.matches.verdict && round.matches.emotion && round.matches.values);
  if (allShared.length) insights.push({
    title: 'You have some shared starting points to put into words',
    pattern: 'Some situations brought your judgments, feelings, and stated priorities into line together.',
    observation: `All three selected answers matched in ${allShared.length} of ${total} rounds.`,
    meaning: 'That common ground could make a useful starting point for decisions you both freely support. The opportunity is to turn apparent understanding into something clear enough to use: what the agreement covers, where exceptions begin, and how either person can reopen it. Matching selections alone cannot show whether you mean exactly the same thing.',
    nextStep: 'Choose one shared answer and turn it into a concrete, two-way agreement rather than leaving it assumed.',
    evidence: pageEvidence(report, allShared, 'factor'),
  });
  const emotionalBridge = report.rounds.filter(round => round.matches.emotion && !round.matches.verdict);
  if (emotionalBridge.length) insights.push({
    title: 'A shared feeling can be a bridge across disagreement',
    pattern: 'You sometimes recognised the same emotional response while describing the action differently.',
    observation: `You selected the same feeling with different verdicts in ${emotionalBridge.length} rounds.`,
    meaning: 'There may be a route into the conversation that does not require winning the argument about a label first. Acknowledging the shared feeling could make it easier to examine the different interpretations without treating them as a contest. This is a possible way to use these particular answers, not proof of how you already handle conflict.',
    nextStep: 'Start with the shared feeling, then ask what each verdict means before debating the label.',
    evidence: pageEvidence(report, emotionalBridge, 'emotion'),
  });
  const players = report.players.map((player, i): PlayerInsight => {
    const priorities = leading(player.priorities);
    const feelings = leading(player.feelings);
    const priorityLabels = priorities.map(item => item.label);
    const observations = [
      priorities.length === 1 ? `${labels(player.priorities)} was your most frequently selected main factor (${priorities[0].count} of ${total} rounds). This shows what you foregrounded here, not your only value.`
        : `${labels(player.priorities)} were tied as your most frequent main factors (${priorities[0].count} rounds each). There is no single leading priority in this session.`,
      feelings.length === 1 ? `Your most frequent selected feeling was ${labels(player.feelings)} (${feelings[0].count} of ${total} rounds). This is a response to these hypothetical situations, not a measure of your usual mood.`
        : `${labels(player.feelings)} were tied as your most frequent feelings (${feelings[0].count} rounds each). Your responses do not point to one predominant feeling here.`,
    ];
    const nextSteps = [
      'Explain which part of an action matters to you, and whether intention or an advance agreement could change its meaning.',
      'Describe the context you would want to understand, while making room for the impact even when the intention was kind.',
      'Agree on what each of you wants to be told, when, and how to preserve privacy without unwanted surprises.',
      'Put one boundary into specific words and check that both of you freely agree, rather than assuming a shared rule.',
      'Describe the response you need when something hurts, and ask your partner what acknowledgement and care look like for them.',
      'Explain what builds trust and emotional safety for you, then choose one small, mutual action that protects that connection.',
    ];
    const priorityIndex = priorities.length === 1 ? samePageReasons.findIndex(reason => reason.label === priorities[0].label) : -1;
    const legacyIndex = priorities.length === 1 ? factors.findIndex(label => label === priorities[0].label) : -1;
    const nextStepIndex = priorityIndex >= 0 ? priorityIndex : legacyIndex;
    return {
      id: player.id, name: player.name, observations,
      nextStep: nextStepIndex >= 0 ? nextSteps[nextStepIndex] : 'Explain one situation in which each of your tied priorities matters, and ask which details change their importance.',
      evidence: report.rounds.filter(round => priorityLabels.includes(scenarioFactors(round.scenario)[round.answers[i].factor])).slice(0, 3).map(round => ({
        title: round.scenario.title, detail: `${scenarioFactors(round.scenario)[round.answers[i].factor]}; ${emotions[round.answers[i].emotion]}`,
      })),
    };
  });
  sections.conversation = {
    ...sections.conversation!,
    question: feelingGap.length ? 'When we agree about an action but feel differently about it, what would help both of us feel heard?'
      : commonPriority.length ? 'When we care about the same principle but reach different conclusions, what detail would help us understand the difference?'
        : differentPriorities.length ? 'When we disagree, how can we check which concern each of us is actually trying to address?'
          : emotionalBridge.length ? 'Could we start with the feeling we recognise in each other before trying to agree on what to call the situation?'
            : 'Which apparently shared understanding would be worth putting into our own words, so neither of us has to assume what the other means?',
  };
  return { ...sections, headline, summary, scope: scopeFor(total), insights, players, signals };
}

export function analyzeParty(game: ChoiceGameState, recap: ReturnType<typeof partyRecap>, labelsByRound: string[][]): RelationshipAnalysis {
  if (!isRelationshipGame(game.gameType)) {
    const written = recap.rounds.filter(round => game.players.some(player => hasWrittenChoiceAnswer(game.answers[round.round][player.id])));
    if (written.length) {
      const rounds = recap.rounds.filter(round => !written.includes(round));
      const structuredGame = { ...game, answers: Object.fromEntries(rounds.map(round => [round.round, game.answers[round.round]])) };
      const structuredRecap = {
        total: rounds.length, rounds,
        players: recap.players.map((player, i) => ({ ...player, matchingPredictions: rounds.filter(round => round.predictionMatches[i] === true).length, predictionCount: rounds.filter(round => round.predictionMatches[i] !== null).length })),
      };
      return includeWrittenPerspectives(analyzeParty(structuredGame, structuredRecap, labelsByRound), written.map(round => ({
        title: game.deck[round.round].title, question: game.deck[round.round].text,
        detail: game.players.map(player => {
          const answer = game.answers[round.round][player.id];
          const labels = labelsByRound[round.round];
          return `${player.name}: ${responseLabel(labels, answer.choice, answer.customChoice)}${answer.prediction !== undefined ? `; predicted partner: ${responseLabel(labels, answer.prediction, answer.customPrediction)}` : ''}`;
        }).join('; '),
      })), recap.total, rounds.length, game.gameType);
    }
  }
  if (isRelationshipGame(game.gameType)) return analyzeRelationshipGame(game);
  const { total, rounds } = recap;
  const sharedGame = game.gameType === 'same-brain' || game.gameType === 'more-likely';
  const signals: AnalysisSignal[] = sharedGame
    ? [{ kind: game.gameType === 'same-brain' ? 'preferences' : 'perceptions', matched: rounds.filter(round => round.matched).length, total }]
    : recap.players.filter(player => player.predictionCount > 0).map(player => ({ kind: 'prediction', matched: player.matchingPredictions, total: player.predictionCount }));
  if (!total) return { ...noEvidence, headline: 'Not enough shared evidence yet', summary: 'No paired answers are available for an analysis.', scope: scopeFor(0), insights: [], players: [], signals };
  const examples = (selected: typeof rounds): InsightEvidence[] => selected.slice(0, 3).map(result => ({
    title: game.deck[result.round].title,
    question: game.deck[result.round].text,
    detail: game.players.map((player, i) => {
      const answer = game.answers[result.round][player.id];
      const role = game.gameType === 'read-the-room' ? result.round % 2 === i ? 'actual response' : 'prediction' : 'actual choice';
      return `${player.name} (${role}): ${labelsByRound[result.round][answer.choice]}${game.gameType === 'pick-my-poison' && answer.prediction !== undefined ? `; predicted partner: ${labelsByRound[result.round][answer.prediction]}` : ''}`;
    }).join('; '),
  }));
  const matched = rounds.filter(round => round.matched);
  const split = rounds.filter(round => !round.matched);
  const readRoom = game.gameType === 'read-the-room';
  const correctPredictions = rounds.filter(round => round.predictionMatches.includes(true));
  const unexpectedPredictions = rounds.filter(round => round.predictionMatches.includes(false));
  const chosen = (readRoom ? unexpectedPredictions[0] : split[0]) ?? rounds[0];
  const chosenAnswers = game.players.map(player => game.answers[chosen.round][player.id]);
  const chosenLabels = labelsByRound[chosen.round];
  const [firstChoice, secondChoice] = chosenAnswers.map(answer => chosenLabels[answer.choice]);
  const responder = chosen.round % 2;
  const actualResponse = chosenLabels[chosenAnswers[responder].choice];
  const predictedResponse = chosenLabels[chosenAnswers[1 - responder].choice];
  const conversationQuestion = readRoom ? actualResponse === predictedResponse
    ? `What helped you anticipate "${actualResponse}" here, and what extra detail might make a different response fit better?`
    : `What extra detail would help ${game.players[1 - responder].name} understand ${game.players[responder].name}'s choice of "${actualResponse}" rather than the predicted "${predictedResponse}"?`
    : game.gameType === 'more-likely'
      ? `What examples led you to choose ${firstChoice === secondChoice ? `"${firstChoice}"` : `"${firstChoice}" and "${secondChoice}"`} for this statement, and when might that perception change?`
      : firstChoice === secondChoice
        ? `What made "${firstChoice}" appealing to both of you here, and when might you choose differently?`
        : `What draws each of you to "${firstChoice}" or "${secondChoice}" here, and what would make the other option more appealing?`;
  const sections: EvidenceSections = {
    alignments: examples(readRoom ? correctPredictions : matched),
    differences: examples(readRoom ? unexpectedPredictions : split),
    alignmentNote: readRoom
      ? 'This saved version alternates responder and predictor. These examples show prediction accuracy, not agreement between two actual preferences.'
      : game.gameType === 'pick-my-poison'
        ? 'These are shared personal choices. Correctly predicting a different preference is tracked separately.'
        : 'These are matching choices from independently submitted answers, not proof of identical reasons or fixed roles.',
    measurements: [
      ...(!readRoom ? [{ label: game.gameType === 'more-likely' ? 'Shared perceptions' : 'Matching personal answers', numerator: matched.length, denominator: total }] : []),
      ...recap.players.filter(player => player.predictionCount > 0).map(player => ({
        label: `${player.name}: ${game.gameType === 'same-brain' ? 'final-round match prediction' : 'partner predictions'}`,
        numerator: player.matchingPredictions, denominator: player.predictionCount,
      })),
    ],
    conversation: {
      question: conversationQuestion,
      context: `From Q${chosen.round + 1}: ${game.deck[chosen.round].title}. ${readRoom ? 'Compare the actual response with the prediction, without judging the response.' : chosen.matched ? 'Your choices matched; explore whether the reasons matched too.' : 'Your choices differed; explore what mattered to each of you.'}`,
      evidence: examples([chosen]),
    },
  };
  const insights: RelationshipInsight[] = [];
  let headline: string;
  let summary: string;
  if (game.gameType === 'same-brain') {
    headline = matched.length > split.length ? 'Shared preferences to build on' : split.length > matched.length ? 'Different preferences worth making room for' : 'An equal mix of shared and different preferences';
    summary = matched.length > split.length
      ? 'In these questions, finding an appealing shared option happened more often than choosing different ones. Those matches could give you concrete ideas for time together.'
      : 'These choices leave room for taking turns, combining ideas, or enjoying different things side by side. Choosing differently is not a measure of closeness.';
    insights.push({
      title: matched.length ? 'Turn shared preferences into something real' : 'Look for the experience underneath the option',
      pattern: matched.length ? 'Some of the same possibilities appealed to both of you independently.' : 'The offered choices brought different preferences into view rather than a single shared plan.',
      observation: matched.length ? `${matched.length} rounds gave you the same actual choice.` : 'No actual choices matched in these completed rounds.',
      meaning: matched.length ? 'Shared choices can provide an easy opening for time together, but they do not tell us which part of an experience each person wants. Discovering what makes a plan appealing could help you preserve the part that matters when time, money, or circumstances change.'
        : 'The options do not tell us why each experience appeals. Different choices could serve a similar wish, or genuinely different wishes; neither conclusion is established yet. Comparing what each person hopes to get from the experience may reveal a better plan than simply taking turns picking a winner.',
      nextStep: matched.length ? 'Pick one shared option and each say which part you would most enjoy before making a small plan.' : 'Each describe the feeling you wanted from one chosen option, then design an alternative together.',
      evidence: examples(matched.length ? matched : split),
    });
    if (split.length) insights.push({
      title: 'Different choices are useful planning information',
      pattern: 'Other decisions did not produce one option you both preferred.',
      observation: `You preferred different options in ${split.length} rounds.`,
      meaning: 'This gives you a place to explore how a shared decision gets made when there is no obvious default. A difference might become complementary if there is room for both experiences; it could become frustrating if either preference is treated as less legitimate. The game reveals the difference, not which of those approaches you use.',
      nextStep: 'Choose one split decision and find a way to alternate, combine the two ideas, or do separate activities without treating that as rejection.',
      evidence: examples(split),
    });
    const expectations = rounds.filter(round => round.predictionMatches.some(match => match !== null));
    const differentExpectations = expectations.some(round => game.answers[round.round][game.players[0].id].matchPrediction !== game.answers[round.round][game.players[1].id].matchPrediction);
    if (expectations.length) insights.push({
      title: 'Expecting a match and making the same choice are different skills',
      pattern: differentExpectations
        ? 'You approached the same decision with different expectations of whether you would agree.'
        : 'You approached one decision with a shared expectation of how alike your choices would be.',
      observation: expectations.map(round => game.players.map((player, i) => `${player.name} predicted ${game.answers[round.round][player.id].matchPrediction ? 'a match' : 'different choices'} and was ${round.predictionMatches[i] ? 'accurate' : 'surprised'}`).join('; ')).join('. ') + '.',
      meaning: 'An expectation of agreement can be worth exploring separately from the preference itself. You may have noticed different cues or imagined different versions of the situation; neither explanation is established by the answers. This one decision cannot reveal confidence in the relationship or general knowledge of your partner, but it can open a smaller conversation about what each person took for granted.',
      nextStep: 'Ask what led to that expectation and whether you were thinking about a shared memory or assuming similar preferences.',
      evidence: examples(expectations),
    });
  } else if (game.gameType === 'more-likely') {
    const both = rounds.filter(round => game.players.every(player => game.answers[round.round][player.id].choice === 2));
    headline = matched.length > split.length ? 'A shared view of some of your roles' : 'Two perspectives on the roles you each play';
    summary = `${both.length ? 'Some descriptions felt like Both of us to you both. ' : ''}${split.length
      ? 'Your different perceptions can help you notice which sides of each other are more visible in different settings.'
      : 'A shared view can give you language for familiar roles, but it should not turn playful answers into fixed expectations.'}`;
    insights.push({
      title: 'A perception is a story to compare, not a role to assign',
      pattern: split.length ? 'You did not always recognise the same person in the same relationship description.' : 'You independently recognised some of the same descriptions of your relationship.',
      observation: `${matched.length} matched perceptions; ${split.length} different perceptions.`,
      meaning: 'These selections tell you how you currently see the examples in the game. A shared view could make a familiar role easy to recognise, while a different view could reflect situations one partner sees more often. Neither establishes the full story. In particular, playful recognition cannot establish who should carry responsibility or what either person is always like.',
      nextStep: 'Pick one example and each describe when you have seen that side of yourselves. Check whether either of you wants that role to change.',
      evidence: examples(split.length ? split : matched),
    });
    if (both.length) insights.push({
      title: 'Some parts of your couple story feel shared',
      pattern: 'For some descriptions, you both saw the quality as belonging to both people rather than just one.',
      observation: `You both chose Both of us in ${both.length} rounds.`,
      meaning: 'That shared recognition could leave room for a less rigid story about who each of you gets to be. It does not prove equal effort or identical behaviour, but it may be useful to explore how the same quality appears differently in each person instead of assigning it to one permanent role.',
      nextStep: 'Ask whether you show this shared side in the same situations or in different ways.',
      evidence: examples(both),
    });
    const namedAgreement = matched.filter(round => game.answers[round.round][game.players[0].id].choice !== 2);
    if (namedAgreement.length >= 2 && split.length) insights.push({
      title: 'Familiar roles can stay negotiable',
      pattern: 'Some descriptions pointed to the same person, while others revealed a different view of each other.',
      observation: `${namedAgreement.length} named-player agreements alongside ${split.length} different perceptions.`,
      meaning: 'A familiar role can be useful shorthand without becoming a permanent assignment. The mixed picture here gives you a reason to distinguish recognition from expectation: seeing a quality in someone does not tell us whether they enjoy being relied on for it. Let each person describe where the role fits and where it feels too narrow.',
      nextStep: 'Choose one familiar role and make room for the person associated with it to keep, share, or question it.',
      evidence: examples([...namedAgreement.slice(0, 2), split[0]]),
    });
  } else {
    headline = game.gameType === 'read-the-room' ? 'A clearer picture of how to ask for support' : 'Knowing your partner is not the same as choosing alike';
    summary = game.gameType === 'read-the-room'
      ? 'The most useful result is learning what each responder actually chose in that situation, not deciding whose support preference is better.'
      : 'A prediction can be accurate even when your own preference is different. This game separates shared taste from what you know about each other.';
    const surprises = rounds.filter(round => round.predictionMatches.includes(false));
    insights.push({
      title: surprises.length ? 'Surprises show where a check-in could replace an assumption' : 'Accurate predictions are a starting point, not permission to assume',
      pattern: surprises.length ? 'Some expectations about a partner did not fit the response that partner actually selected.' : 'The recorded predictions found their way to the responses the other person actually selected.',
      observation: surprises.length ? `${surprises.length} rounds included at least one unexpected actual response.` : 'Every prediction in these completed rounds matched the actual response.',
      meaning: game.gameType === 'read-the-room'
        ? surprises.length
          ? 'Support that sounds helpful to one person may not be the support the other selects. The useful distinction is between noticing a situation and knowing what response fits the person in it. A small check-in could bridge that gap without requiring either person to become a mind reader. The recipient can say what fits now; a hypothetical choice is not a standing instruction.'
          : 'Your expectations fitted the selected responses here. That could give you a useful starting point for asking about the cues you noticed, but the answers do not reveal whether a prediction came from a previous conversation, intuition, or a guess. Let the other person confirm what fits rather than treating a good prediction as a standing instruction.'
        : surprises.length
          ? 'A dilemma asks which cost someone would rather accept, not just which option sounds nicer. An unexpected choice could therefore be an opening to understand a trade-off you had not considered. It does not, by itself, show that you are inattentive, that your partner is inconsistent, or that you do not know each other.'
          : 'Your expectations fitted the personal choices in these dilemmas. That offers an opening to compare what you thought mattered with what the other person actually considered. Accuracy alone cannot tell us whether the reasons were understood; checking those reasons could make this familiarity useful beyond the options on the screen.',
      nextStep: game.gameType === 'read-the-room' ? 'Try a low-pressure check-in: “Would you like listening, ideas, company, or space right now?” Let the answer change.'
        : 'Each explain the cost you wanted to avoid in one surprising dilemma, then check what could change that choice.',
      evidence: examples(surprises.length ? surprises : rounds),
    });
    if (game.gameType === 'pick-my-poison') {
      const understoodDifference = rounds.filter(round => !round.matched && round.predictionMatches.includes(true));
      if (understoodDifference.length) insights.push({
        title: 'You can understand a preference you do not share',
        pattern: 'Different personal choices sometimes sat alongside an accurate prediction of the other person.',
        observation: `In ${understoodDifference.length} rounds you chose differently, but at least one partner still predicted the other accurately.`,
        meaning: 'Those examples distinguish knowing someone from agreeing with them. They suggest that, in these situations, understanding did not depend on making the other person more like you. That could be a useful starting point for handling a real trade-off: represent each preference fairly before deciding what to do together, without treating either one as the obvious standard.',
        nextStep: 'Ask what helped the accurate prediction, and try using that curiosity in a decision outside the game.',
        evidence: examples(understoodDifference),
      });
      if (matched.length) insights.push({
        title: 'A shared choice can hide a different trade-off',
        pattern: 'Some dilemmas led you to the same personal preference, separately from how well you predicted each other.',
        observation: `${matched.length} personal-choice matches among the completed dilemmas.`,
        meaning: 'Choosing the same option does not reveal whether the attraction was the same, or whether you were each avoiding a different downside. That distinction could matter when you make a real decision with fewer convenient alternatives. The agreement is a starting point for understanding the trade-off, not evidence that you decide in the same way.',
        nextStep: 'Each describe what you hoped to gain and what cost you were willing to accept, before treating a shared decision as settled.',
        evidence: examples(matched),
      });
      const ownLens = rounds.filter(round => game.players.some((player, i) => {
        const answer = game.answers[round.round][player.id];
        return answer.prediction === answer.choice && round.predictionMatches[i] === false;
      }));
      if (ownLens.length >= 2) insights.push({
        title: 'Your own answer may be only one possible starting point',
        pattern: 'Some expectations echoed the predictor’s own preference rather than the choice their partner made.',
        observation: `${ownLens.length} dilemmas included a missed prediction that repeated the predictor's own choice.`,
        meaning: 'This cannot tell us how either person arrived at a guess. It does, however, offer a useful possibility to check: whether imagining what you would choose is sometimes standing in for exploring what matters to the other person. Noticing that distinction can support curiosity without turning an unexpected answer into a failure of care.',
        nextStep: 'Before a shared decision, represent the appeal of the option you would not choose and let your partner correct what you missed.',
        evidence: examples(ownLens),
      });
    } else {
      const variablePredictions = rounds.filter(round => game.players.some((_, i) => round.predictionMatches[i] !== null
        && rounds.some(other => other.predictionMatches[i] !== null && other.predictionMatches[i] !== round.predictionMatches[i])));
      if (variablePredictions.length >= 2) insights.push({
        title: 'Familiarity may be situation-specific',
        pattern: 'A predictor could anticipate a response in one situation and be surprised in another.',
        observation: 'The same predictor had both an accurate and an unexpected response across different situations.',
        meaning: 'That mixed picture argues against treating one result as a verdict on how well someone is known. The relevant question may be which cues were available, and what extra context changes the response. Your answers support exploring that context; they do not identify a permanent communication or support style.',
        nextStep: 'Compare the cues that felt informative with the ones that needed clarification, and let a check-in remain part of knowing each other.',
        evidence: examples(variablePredictions),
      });
      const mutualSurprises = game.players.every((_, i) => rounds.some(round => round.predictionMatches[i] === false));
      if (mutualSurprises) insights.push({
        title: 'Neither of you needs to be the mind reader',
        pattern: 'Unexpected responses appeared in both directions as you exchanged roles.',
        observation: 'Each partner had at least one prediction that differed from the actual response.',
        meaning: 'In these examples, the gap between an intention to understand and an accurate interpretation was not confined to one person. Making a preference explicit could be a shared practice rather than a correction one partner must always give the other. This does not establish equal effort or a real-life conflict; it suggests a reciprocal way to handle uncertainty.',
        nextStep: 'Let both people practise naming what would fit the moment, instead of assigning one person the job of always knowing.',
        evidence: examples(unexpectedPredictions),
      });
    }
  }
  const players = game.players.map((player, i): PlayerInsight => {
    const partner = game.players[1 - i];
    const ownRounds = game.gameType === 'read-the-room' ? rounds.filter(round => round.round % 2 === i) : rounds;
    const observations: string[] = [];
    if (game.gameType === 'more-likely') {
      const self = rounds.filter(round => game.answers[round.round][player.id].choice === i).length;
      const other = rounds.filter(round => game.answers[round.round][player.id].choice === 1 - i).length;
      const both = rounds.length - self - other;
      observations.push(`You selected yourself in ${roundCount(self)}, ${partner.name} in ${other}, and Both of us in ${both}. The statements differ, so these counts are not a measure of confidence, responsibility, or effort.`);
    } else if (game.gameType === 'read-the-room') {
      observations.push(`You shared ${ownRounds.length} actual responses about support or reactions. These give ${partner.name} examples to ask about, not a fixed support style.`);
    } else {
      observations.push(`${matched.length === total ? 'You and your partner selected the same options throughout these rounds.' : matched.length ? 'Some offered options appealed to both of you; others brought different preferences into view.' : 'The offered options brought different preferences into view throughout these rounds.'} This does not establish how similar your personalities are.`);
    }
    const personal = recap.players[i];
    if (!sharedGame) observations.push(!personal.predictionCount
      ? 'No predicting turn was recorded for you in these completed rounds.'
      : `${personal.matchingPredictions === personal.predictionCount ? 'Your recorded predictions anticipated your partner’s selected responses.' : personal.matchingPredictions ? 'Some predictions anticipated your partner’s response; others revealed a different choice than expected.' : 'Your recorded predictions differed from your partner’s selected responses.'} These are openings to explore context, not a measure of how well you care for each other.`);
    if (game.gameType === 'pick-my-poison') {
      const echo = rounds.filter(round => {
        const answer = game.answers[round.round][player.id];
        return answer.prediction === answer.choice;
      });
      const misses = echo.filter(round => round.predictionMatches[i] === false);
      if (echo.length) observations.push(`Your prediction was the same as your own choice in ${roundCount(echo.length)}; ${misses.length} of those predictions missed. This does not tell us how you reasoned, but offers a way to check whether your own preference influenced the guess.`);
    }
    return {
      id: player.id, name: player.name, observations,
      nextStep: game.gameType === 'more-likely' ? 'Ask about one role your partner sees differently, without treating either perception as the final word.'
        : game.gameType === 'same-brain' ? 'Name one preference you want to keep for yourself and one shared option you would like to try together.'
          : 'Ask about the reason behind one unexpected answer, then use what you learn as a question next time rather than a fixed rule.',
      evidence: ownRounds.slice(0, 3).map(round => ({ title: game.deck[round.round].title, detail: `${player.name} chose "${labelsByRound[round.round][game.answers[round.round][player.id].choice]}".` })),
    };
  });
  sections.conversation = {
    ...sections.conversation!,
    question: game.gameType === 'read-the-room'
      ? 'When a situation is hard to read, how would we like to ask what the other person needs without making them feel misunderstood?'
      : game.gameType === 'more-likely'
        ? split.length ? 'Which role might we see differently, and how could we make room for both stories without making either one the final word?'
          : 'Which familiar role feels freely chosen, and which would we like to be able to share or change?'
        : game.gameType === 'pick-my-poison'
          ? split.length ? 'When we want different things, how can we show that we understand the other person’s trade-off before deciding what to do together?'
            : 'When we reach the same decision, how can we check whether we are choosing it for the same reason?'
          : split.length ? 'When no single plan appeals to both of us, what would make the decision feel fair without asking either person to stop wanting what they want?'
            : 'What makes a shared experience meaningful to each of us beyond simply agreeing on the plan?',
  };
  return { ...sections, headline, summary, scope: scopeFor(total), insights, players, signals };
}

export function combineAnalyses(games: { title: string; analysis: RelationshipAnalysis }[]): RelationshipAnalysis {
  const signals = games.flatMap(game => game.analysis.signals);
  if (!signals.some(signal => signal.total > 0) && !games.some(game => game.analysis.insights.some(insight => insight.evidence.length > 0))) return {
    ...noEvidence, headline: 'Not enough shared evidence yet',
    summary: 'There are no completed paired answers to compare across these games.',
    scope: scopeFor(0), insights: [], players: [], signals,
  };
  const insights: RelationshipInsight[] = [];
  const preferences = signals.find(signal => signal.kind === 'preferences' && signal.total > 0);
  const predictions = signals.filter(signal => signal.kind === 'prediction' && signal.total > 0);
  if (preferences && predictions.length && (preferences.matched < preferences.total || predictions.some(signal => signal.matched < signal.total))) {
    const predictionMatches = predictions.reduce((sum, signal) => sum + signal.matched, 0);
    const predictionTotal = predictions.reduce((sum, signal) => sum + signal.total, 0);
    insights.push({
      title: preferences.matched < preferences.total / 2 && predictionMatches >= predictionTotal / 2 ? 'Different tastes can coexist with understanding each other' : 'Shared taste and knowing each other are separate threads',
      pattern: preferences.matched < preferences.total / 2 && predictionMatches >= predictionTotal / 2
        ? 'Different personal preferences in one game coexisted with accurate expectations of each other in the prediction games.'
        : 'Your games showed that choosing alike and anticipating another person’s response can part ways.',
      observation: `Same Brain choices matched in ${preferences.matched} of ${preferences.total} rounds. Across the prediction games, ${predictionMatches} of ${predictionTotal} guesses matched actual responses.`,
      meaning: preferences.matched < preferences.total / 2 && predictionMatches >= predictionTotal / 2
        ? 'In these examples, being able to hold another preference in mind did not require adopting it. That could offer a useful model for a real decision: make room for what appeals to the other person before trying to find a shared plan. It is a possible strength in these responses, not evidence that every difference is already easy to handle.'
        : 'A familiar preference does not necessarily reveal which detail will matter in another situation. The mixed evidence leaves room to ask where understanding feels straightforward and where a clearer question could help. These are different tasks, not comparable compatibility tests; neither a good prediction nor a shared preference explains the whole relationship.',
      nextStep: 'Compare one shared choice with one surprising prediction. Ask what you knew in the first situation and what you needed to ask in the second.',
      evidence: games.filter(game => game.analysis.signals.some(signal => signal.kind === 'preferences' || signal.kind === 'prediction')).flatMap(game =>
        game.analysis.insights.flatMap(insight => insight.evidence).slice(0, 2).map(example => ({ ...example, title: `${game.title} · ${example.title}` }))),
    });
  }
  const page = games.find(game => game.analysis.signals.some(signal => signal.kind === 'emotion'));
  const boundaryDifference = page?.analysis.insights.find(insight =>
    insight.title.includes('emotional experience') || insight.title.includes('different conclusions') || insight.title.includes('different parts'));
  const lighterShared = games.some(game => game.analysis.signals.some(signal => (signal.kind === 'preferences' || signal.kind === 'perceptions') && signal.matched > 0));
  if (page && boundaryDifference && lighterShared) insights.push({
    title: 'Shared ground does not remove the need to check in',
    pattern: `${boundaryDifference.pattern} Elsewhere, the lighter games also brought some common ground into view.`,
    observation: page.analysis.summary,
    meaning: 'The common ground may give you an easy place to connect, without making a more sensitive difference less important. If something feels settled in a playful conversation, that is not a reason to expect the same ease around a boundary or a feeling. The broader picture here leaves room for both familiarity and a need for clarification, rather than letting one result cancel the other.',
    nextStep: 'Make room for a sensitive concern in its own terms, without using an easier shared preference as evidence that it should already feel resolved.',
    evidence: games.flatMap(game => game.analysis.insights.flatMap(insight => insight.evidence).slice(0, 1).map(example => ({ ...example, title: `${game.title} · ${example.title}` }))),
  });
  const readings = games.map(game => selectReportInsights(game.analysis).map(insight => ({ ...insight, title: `${game.title} · ${insight.title}` })));
  insights.push(...(games.some(game => game.analysis.context)
    ? Array.from({ length: Math.max(0, ...readings.map(reading => reading.length)) }, (_, index) => readings.flatMap(reading => reading[index] ? [reading[index]] : [])).flat()
    : readings.flat()));
  const identities = [...new Map(games.flatMap(game => game.analysis.players.map(player => [player.id, player] as const))).values()];
  const players = identities.map(({ id, name }) => ({
    id, name, observations: games.flatMap(game => game.analysis.players.filter(player => player.id === id).map(player => `${game.title}: ${player.observations[0]}`)),
    nextStep: 'Choose the observation that fits your experience best and the one that needs more context. Let your partner hear both.',
    evidence: games.flatMap(game => game.analysis.players.filter(player => player.id === id).flatMap(player => player.evidence.slice(0, 1))),
  }));
  return {
    alignments: games.flatMap(game => game.analysis.alignments.slice(0, 1).map(example => ({ ...example, title: `${game.title} · ${example.title}` }))),
    differences: games.flatMap(game => game.analysis.differences.slice(0, 1).map(example => ({ ...example, title: `${game.title} · ${example.title}` }))),
    alignmentNote: 'Each game measures something different. Shared choices, perceptions, feelings, and accurate predictions are not combined into a compatibility score.',
    measurements: games.flatMap(game => game.analysis.measurements.map(measurement => ({ ...measurement, label: `${game.title} · ${measurement.label}` }))),
    conversation: (games.find(game => game.analysis.differences.length && game.analysis.conversation) ?? games.find(game => game.analysis.conversation))?.analysis.conversation ?? null,
    headline: 'Your couple story has more than one thread',
    summary: games.map(game => `${game.title}: ${game.analysis.headline}.`).join(' '),
    scope: `A synthesis of ${games.length} completed games, not a relationship diagnosis or a prediction of your future. Game measures stay separate; the observations only cover the situations you played.`,
    insights, players, signals,
  };
}

export function insightSupport(insight: RelationshipInsight): 'repeated' | 'limited' {
  return new Set(insight.evidence.map(example => example.question ?? example.title)).size >= 2 ? 'repeated' : 'limited';
}

export function selectReportInsights(analysis: RelationshipAnalysis): RelationshipInsight[] {
  const repeated = analysis.insights.filter(insight => insightSupport(insight) === 'repeated');
  const limited = analysis.insights.filter(insight => insightSupport(insight) === 'limited');
  return [...repeated.slice(0, 4), ...limited.slice(0, repeated.length < 4 ? 1 : 0)].slice(0, 4);
}

export function analysisText(analysis: RelationshipAnalysis, includeEvidence = false): string[] {
  return [
    'YOUR RELATIONSHIP, BETWEEN THE LINES',
    ...(!analysis.insights.length ? ['There are not enough paired answers for a relationship interpretation yet.'] : []),
    ...selectReportInsights(analysis).flatMap(insight => [
      '', insight.title,
      insightSupport(insight) === 'limited' ? 'A small observation, not a recurring pattern.' : 'Seen across different situations in this game.',
      insight.pattern, insight.meaning, `In practice: ${insight.nextStep}`,
      ...(includeEvidence ? [insight.observation, ...insight.evidence.map(example => `Evidence — ${example.title}: ${example.question ?? ''} ${example.detail}`)] : []),
    ]),
    ...(includeEvidence ? ['', 'A CLOSER LOOK AT EACH OF YOU', ...analysis.players.flatMap(player => [
      player.name, ...player.observations, ...player.evidence.map(example => `${example.title}: ${example.detail}`),
      `A next step: ${player.nextStep}`,
    ])] : []),
    '', 'ABOUT THIS READING', analysis.scope,
    '', 'SOMETHING WORTH DISCOVERING TOGETHER',
    ...(analysis.conversation ? [analysis.conversation.question] : ['There are not enough paired answers to choose a conversation based on this game yet.']),
  ];
}

export type ReportFormat = 'insights' | 'archive';

export function relationshipReportText(title: string, names: string[], analysis: RelationshipAnalysis, demo: boolean): string {
  return [
    `${title.toUpperCase()} | YOUR PRIVATE RELATIONSHIP READING`, names.join(' & '),
    ...(demo ? ['DEMO: one partner is simulated. This does not describe a real couple.'] : []),
    'Private reflections, not a relationship grade, diagnosis, or prediction. Save or share only with both players’ agreement.',
    '', ...analysisText(analysis),
  ].join('\n');
}
