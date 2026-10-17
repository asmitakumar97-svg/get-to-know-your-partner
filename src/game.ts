import { buildSectionDeck, type Scenario, type Section } from './scenarios';
import { samePageLibrary } from './samePageLibrary';
import type { ChoiceScenario, PartyGameId } from './catalog';
import type { GameNight } from './night';
import type { GameReflection } from './relationshipGames';
import { compareResponses, validResponse } from './writtenAnswers';

export const verdicts = ['Nothing wrong', 'Neutral / depends on context', 'Micro-cheating', 'Red flag / disrespectful', 'Cheating'] as const;
export function scenarioVerdicts(scenario: Scenario): readonly string[] {
  if (scenario.verdictOptions === undefined) return verdicts;
  if (![5, 6].includes(scenario.verdictOptions.length) || scenario.verdictOptions.some(option => typeof option !== 'string' || !option.trim())) throw new Error('This saved scenario has invalid verdict options.');
  return scenario.verdictOptions;
}
export const emotions = ['Completely fine', 'Confused / uncomfortable', 'Hurt / disrespected', 'Jealous / insecure', 'Betrayed / trust affected'] as const;
export const factors = ['The action itself', 'Context and intentions', 'Transparency', 'Previously agreed boundaries'] as const;
export function scenarioFactors(scenario: Scenario): readonly string[] {
  if (scenario.reasonOptions === undefined) return factors;
  if (scenario.reasonOptions.length !== 6 || scenario.reasonOptions.some(option => typeof option !== 'string' || !option.trim())) throw new Error('This saved scenario has invalid reasoning options.');
  return scenario.reasonOptions;
}
export interface Answer { verdict: number; emotion: number; factor: number; explanation: string; customVerdict?: string; customEmotion?: string; customFactor?: string }
export interface ChoiceAnswer { choice: number; prediction?: number; matchPrediction?: boolean; explanation: string; items?: number[]; customChoice?: string; customPrediction?: string }
export interface Player { id: string; name: string; left: boolean }
interface BaseGameState<A, S extends Scenario = Scenario> {
  switchedQuestions?: Pick<Scenario, 'id' | 'text'>[];
  skippedRounds?: number[];
  reflections?: Record<string, Record<string, GameReflection>>;
  myReflections?: Record<string, GameReflection>;
  myClues?: Record<string, string>;
  night?: GameNight;
  revision?: number;
  id: string;
  code: string;
  mode: 'local' | 'demo' | 'online';
  players: Player[];
  deck: S[];
  round: number;
  phase: 'lobby' | 'answering' | 'discussion' | 'recap';
  answers: Record<string, Record<string, A>>;
  submitted: string[];
  ready: string[];
  discussionUntil: number | null;
  discussionSeconds: number;
}
export interface GameState extends BaseGameState<Answer> { gameType?: 'same-page' }
export interface ChoiceGameState extends BaseGameState<ChoiceAnswer, ChoiceScenario> { gameType: PartyGameId }
export type SessionState = GameState | ChoiceGameState;
export function isChoiceGame(state: SessionState): state is ChoiceGameState {
  return state.gameType !== undefined && state.gameType !== 'same-page';
}
export const validAnswer = (a: Answer, scenario?: Scenario) =>
  validResponse(a.verdict, a.customVerdict, scenario ? scenarioVerdicts(scenario).length : verdicts.length) &&
  validResponse(a.emotion, a.customEmotion, emotions.length) &&
  validResponse(a.factor, a.customFactor, scenario ? scenarioFactors(scenario).length : factors.length) &&
  typeof a.explanation === 'string' && a.explanation.length <= 600;

export function createGame(mode: 'local' | 'demo', names: string[], count: number, seconds: number, selectedSections?: readonly Section[], preparedDeck?: Scenario[]): GameState {
  const deck = [...samePageLibrary];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return {
    id: crypto.randomUUID(), code: 'TOGETHER', mode,
    players: names.map((name, i) => ({ id: `player-${i}`, name, left: false })),
    deck: preparedDeck ?? (selectedSections ? buildSectionDeck(selectedSections) : deck.slice(0, count)), round: 0, phase: 'answering', answers: {},
    submitted: [], ready: [], discussionUntil: null, discussionSeconds: seconds,
  };
}

export function submitAnswer(state: GameState, playerId: string, answer: Answer, now = Date.now()): GameState {
  if (!validAnswer(answer, state.deck[state.round])) throw new Error('Please answer all three questions before submitting.');
  if (state.phase !== 'answering' || !state.players.some(p => p.id === playerId && !p.left)) throw new Error('This round is not accepting answers.');
  if (state.submitted.includes(playerId)) return state;
  const roundAnswers = { ...state.answers[state.round], [playerId]: answer };
  const submitted = [...state.submitted, playerId];
  return {
    ...afterSubmission(state, submitted, now),
    answers: { ...state.answers, [state.round]: roundAnswers },
  };
}

export function afterSubmission<S extends SessionState>(state: S, submitted: string[], now: number): S {
  const both = submitted.length === 2;
  return { ...state, submitted, phase: both ? 'discussion' : 'answering', discussionUntil: both ? now + state.discussionSeconds * 1000 : null };
}

export function readyForNext<S extends SessionState>(state: S, playerId: string, _now?: number): S {
  if (state.phase !== 'discussion' || !state.players.some(p => p.id === playerId && !p.left)) throw new Error('Discussion is not active.');
  const ready = [...new Set([...state.ready, playerId])];
  if (ready.length < 2) return { ...state, ready };
  return {
    ...state, phase: state.round + 1 === state.deck.length ? 'recap' : 'answering',
    round: state.round + 1 === state.deck.length ? state.round : state.round + 1,
    submitted: [], ready: [], discussionUntil: null,
  };
}

export function alignment(a: Answer, b: Answer) {
  return { verdict: compareResponses(a.verdict, b.verdict), emotion: compareResponses(a.emotion, b.emotion), values: compareResponses(a.factor, b.factor) };
}

export function recap(state: GameState) {
  const rounds = Object.values(state.answers).filter(a => state.players.every(p => a[p.id]));
  const matches = { verdict: 0, emotion: 0, values: 0 };
  for (const answers of rounds) {
    const result = alignment(answers[state.players[0].id], answers[state.players[1].id]);
    for (const key of ['verdict', 'emotion', 'values'] as const) matches[key] += Number(result[key]);
  }
  return { total: rounds.length, ...matches };
}
