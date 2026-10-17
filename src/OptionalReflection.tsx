import { useState } from 'react';
import type { ChoiceGameState } from './game';
import { reactionChoices, reflectionKinds, type GameReflection } from './relationshipGames';

export function OptionalReflection({ game, myId, busy, onSave }: { game: ChoiceGameState; myId: string; busy: boolean; onSave: (player: string, note: GameReflection) => Promise<void> }) {
  const [writer, setWriter] = useState(game.mode === 'local' ? '' : myId);
  return <details className="optional-reflection"><summary>React or reflect · optional</summary>
    <p>No explanation is required. A private note is visible only to its author online. On a shared device, privacy depends on taking turns and trust.</p>
    {game.mode === 'local' && <div className="reflection-writers">{game.players.map(player => <button className="button cream" key={player.id} onClick={() => setWriter(player.id)} aria-pressed={writer === player.id}>I’m {player.name}. Write privately</button>)}</div>}
    {writer && <ReflectionForm key={`${game.round}:${writer}`} game={game} writer={writer} busy={busy} onSave={onSave} />}
    <SharedReflections game={game} round={game.round} />
  </details>;
}
export function SharedReflections({ game, round }: { game: ChoiceGameState; round: number }) {
  const shared = Object.entries(game.reflections?.[round] ?? {}).filter(([, note]) => note.shared);
  return shared.length ? <section aria-label="Voluntarily shared reflections"><h4>Shared with each other</h4>{shared.map(([id, note]) => <blockquote key={id}><strong>{game.players.find(p => p.id === id)?.name}</strong><p>{note.reaction ?? note.kind}</p>{note.explanation && <p>{note.explanation}</p>}</blockquote>)}</section> : null;
}
function ReflectionForm({ game, writer, busy, onSave }: { game: ChoiceGameState; writer: string; busy: boolean; onSave: (player: string, note: GameReflection) => Promise<void> }) {
  const saved = game.myReflections?.[game.round] ?? game.reflections?.[game.round]?.[writer];
  const [note, setNote] = useState<GameReflection>(saved ?? { explanation: '', shared: false });
  const stored = saved && saved.explanation === note.explanation && saved.shared === note.shared && saved.reaction === note.reaction && saved.kind === note.kind;
  return <form className="reflection-form" onSubmit={event => { event.preventDefault(); void onSave(writer, note); }}>
    <fieldset><legend>{game.gameType === 'when-things-get-hard' ? 'Is this what usually happens, or what you wish would happen?' : 'How does this reveal feel?'}</legend>
      {(game.gameType === 'when-things-get-hard' ? reflectionKinds : reactionChoices).map(label => <label className="choice" key={label}><input type="radio" name={`reflection-${writer}`} checked={note.reaction === label || note.kind === label} onChange={() => setNote(game.gameType === 'when-things-get-hard' ? { ...note, kind: reflectionKinds.find(kind => kind === label), reaction: undefined } : { ...note, reaction: reactionChoices.find(reaction => reaction === label), kind: undefined })} /><span>{label}</span></label>)}
    </fieldset>
    <label>A little context · optional<textarea maxLength={600} value={note.explanation} onChange={event => setNote({ ...note, explanation: event.target.value })} /></label>
    <label className="reflection-consent"><input type="checkbox" checked={note.shared} onChange={event => setNote({ ...note, shared: event.target.checked })} /> Share this reflection with my partner and include it in our report</label>
    <button className="button cream" disabled={busy || (!note.reaction && !note.kind && !note.explanation.trim())}>Save {note.shared ? 'shared reflection' : 'private note'}</button>{stored && <p role="status">Saved {note.shared ? 'and shared with your partner' : 'privately'}.</p>}
  </form>;
}
