import { createClient } from '@supabase/supabase-js';
import type { Answer, ChoiceAnswer, SessionState } from './game';
import { buildDeck, type GameId } from './catalog';
import { buildPlaylist, type NightEntry } from './night';
import { buildSectionDeck, type Scenario, type Section } from './scenarios';
import type { QuestionRequest } from '../supabase/functions/_shared/questions';
import { isRelationshipGame, type GameReflection } from './relationshipGames';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const onlineConfigured = Boolean(supabase);

export async function identity() {
  if (!supabase) throw new Error('Online rooms need Supabase configuration. Same-device play and the demo are ready now.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.user.id;
  const result = await supabase.auth.signInAnonymously();
  if (result.error) throw result.error;
  if (!result.data.user) throw new Error('Could not create your private player identity.');
  return result.data.user.id;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Online rooms are not configured.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (name === 'switch_game_question' && error.code === 'PGRST202') throw new Error('Online question switching needs database migration 008. Update Supabase before switching questions online.');
    throw new Error(error.message);
  }
  return data as T;
}
async function sessionRpc(name: string, args: Record<string, unknown>): Promise<SessionState> {
  const state = await rpc<SessionState>(name, args);
  if (!isRelationshipGame(state.gameType)) return state;
  const notes = await rpc<{ reflections: Record<string, GameReflection>; clues: Record<string, string> }>('my_game_notes', { room_id: state.id, game_index: state.night?.index ?? 0 });
  return { ...state, myReflections: notes.reflections, myClues: notes.clues };
}
export const getRoom = (id: string) => sessionRpc('game_state', { room_id: id });
export const createRoom = (name: string, count: number, seconds: number, gameType: GameId = 'same-page', selectedSections?: readonly Section[], preparedDeck?: Scenario[]) =>
  sessionRpc(gameType === 'same-page' ? 'create_game' : 'create_game_mode', {
    player_name: name, scenario_deck: preparedDeck ?? (gameType === 'same-page' && selectedSections ? buildSectionDeck(selectedSections) : buildDeck(gameType, count)), discussion_seconds: seconds,
    ...(gameType === 'same-page' ? {} : { game_kind: gameType }),
  });
export const joinRoom = (code: string, name: string) =>
  sessionRpc('join_game', { room_code: code.trim().toUpperCase(), player_name: name });
export const startRoom = (id: string) => sessionRpc('start_game', { room_id: id });
export const sendAnswer = (id: string, round: number, answer: Answer | ChoiceAnswer, nightIndex?: number, questionId?: string) =>
  sessionRpc(nightIndex === undefined ? 'answer_game' : 'answer_night_game', {
    room_id: id, round_number: round, payload: { ...answer, questionId }, ...(nightIndex === undefined ? {} : { game_index: nightIndex }),
  });
export const sendReady = (id: string, round: number, nightIndex?: number) =>
  sessionRpc(nightIndex === undefined ? 'ready_game' : 'ready_night_game', {
    room_id: id, round_number: round, ...(nightIndex === undefined ? {} : { game_index: nightIndex }),
  });
export const createNightRoom = (name: string, ids: GameId[], count: number, seconds: number, selectedSections?: readonly Section[], preparedPlaylist?: NightEntry[]) =>
  sessionRpc('create_game_night', { player_name: name, game_plan: preparedPlaylist ?? buildPlaylist(ids, count, selectedSections), discussion_seconds: seconds });
export const advanceNightRoom = (id: string, index: number) =>
  sessionRpc('advance_game_night', { room_id: id, game_index: index });
export const leaveRoom = (id: string) => sessionRpc('leave_game', { room_id: id });
export const sendReflection = (id: string, round: number, note: GameReflection, nightIndex?: number) =>
  sessionRpc('save_game_reflection', { room_id: id, round_number: round, payload: note, game_index: nightIndex ?? null });
export const sendSkip = (id: string, round: number, nightIndex?: number, questionId?: string) =>
  sessionRpc(nightIndex === undefined ? 'answer_game' : 'answer_night_game', {
    room_id: id, round_number: round, payload: { skip: true, questionId }, ...(nightIndex === undefined ? {} : { game_index: nightIndex }),
  });
export const sendQuestionSwitch = (id: string, round: number, questionId: string, replacement: Scenario, nightIndex?: number) =>
  sessionRpc('switch_game_question', { room_id: id, round_number: round, expected_question_id: questionId, replacement, game_index: nightIndex ?? null });

export async function generateQuestions(request: QuestionRequest): Promise<unknown> {
  if (!supabase) throw new Error('The online question service is not configured.');
  await identity();
  const { data, error } = await supabase.functions.invoke('fresh-questions', { body: request });
  if (error) throw new Error('The online question service could not respond. Check connectivity, function deployment, or the daily generation limit.');
  return data;
}
