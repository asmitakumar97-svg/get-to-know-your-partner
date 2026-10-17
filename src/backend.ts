import { createClient } from '@supabase/supabase-js';
import type { Answer, ChoiceAnswer, SessionState } from './game';
import { buildDeck, type GameId } from './catalog';
import { buildPlaylist, type NightEntry } from './night';
import { buildSectionDeck, type Scenario, type Section } from './scenarios';
import type { QuestionRequest } from '../supabase/functions/_shared/questions';

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
  if (error) throw new Error(error.message);
  return data as T;
}
export const getRoom = (id: string) => rpc<SessionState>('game_state', { room_id: id });
export const createRoom = (name: string, count: number, seconds: number, gameType: GameId = 'same-page', selectedSections?: readonly Section[], preparedDeck?: Scenario[]) =>
  rpc<SessionState>(gameType === 'same-page' ? 'create_game' : 'create_game_mode', {
    player_name: name, scenario_deck: preparedDeck ?? (gameType === 'same-page' && selectedSections ? buildSectionDeck(selectedSections) : buildDeck(gameType, count)), discussion_seconds: seconds,
    ...(gameType === 'same-page' ? {} : { game_kind: gameType }),
  });
export const joinRoom = (code: string, name: string) =>
  rpc<SessionState>('join_game', { room_code: code.trim().toUpperCase(), player_name: name });
export const startRoom = (id: string) => rpc<SessionState>('start_game', { room_id: id });
export const sendAnswer = (id: string, round: number, answer: Answer | ChoiceAnswer, nightIndex?: number) =>
  rpc<SessionState>(nightIndex === undefined ? 'answer_game' : 'answer_night_game', {
    room_id: id, round_number: round, payload: answer, ...(nightIndex === undefined ? {} : { game_index: nightIndex }),
  });
export const sendReady = (id: string, round: number, nightIndex?: number) =>
  rpc<SessionState>(nightIndex === undefined ? 'ready_game' : 'ready_night_game', {
    room_id: id, round_number: round, ...(nightIndex === undefined ? {} : { game_index: nightIndex }),
  });
export const createNightRoom = (name: string, ids: GameId[], count: number, seconds: number, selectedSections?: readonly Section[], preparedPlaylist?: NightEntry[]) =>
  rpc<SessionState>('create_game_night', { player_name: name, game_plan: preparedPlaylist ?? buildPlaylist(ids, count, selectedSections), discussion_seconds: seconds });
export const advanceNightRoom = (id: string, index: number) =>
  rpc<SessionState>('advance_game_night', { room_id: id, game_index: index });
export const leaveRoom = (id: string) => rpc<SessionState>('leave_game', { room_id: id });

export async function generateQuestions(request: QuestionRequest): Promise<unknown> {
  if (!supabase) throw new Error('The online question service is not configured.');
  await identity();
  const { data, error } = await supabase.functions.invoke('fresh-questions', { body: request });
  if (error) throw new Error('The online question service could not respond. Check connectivity, function deployment, or the daily generation limit.');
  return data;
}
