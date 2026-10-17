import { useState } from 'react';
import type { ChoiceAnswer, ChoiceGameState } from './game';
import { adventureState, validAdventureAnswer } from './adventures';
import { AdventureObject, RelationshipArt } from './RelationshipArt';
import { QuickDiscussion } from './QuickDiscussion';
import { OptionalReflection } from './OptionalReflection';
import type { GameReflection } from './relationshipGames';

export function AdventureEnding({ game }: { game: ChoiceGameState }) {
  const state = adventureState(game, game.deck.length - 1);
  if (state.log.length < game.deck.length) return <section className="adventure-ending"><RelationshipArt kind={state.definition.id} /><div><h3>An unfinished chapter.</h3><p>This adventure ended before every chapter was completed. There is no final outcome to infer; the reading considers only the contributions you both committed.</p></div></section>;
  return <section className="adventure-ending"><RelationshipArt kind={state.definition.id} /><div><span className="eyebrow">YOUR COOPERATIVE ENDING</span><h3>{state.ending}</h3><p>{state.achieved ? 'Together, your recorded actions secured the shared checklist.' : 'Your choices led to the safe alternative route. A replay can explore another plan.'}</p><p>{state.definition.goal.map(goal => `${goal}: ${state.flags.includes(goal) ? 'secured' : 'still open'}`).join(' · ')}</p><small>This is the outcome of this adventure, not a measure of your relationship.</small></div></section>;
}
export function AdventureEvidence({ game, round }: { game: ChoiceGameState; round: number }) {
  const scene = game.deck[round].adventure;
  if (!scene) throw new Error('Adventure rules are missing.');
  const state = adventureState(game, round);
  return <div className="adventure-feedback"><div className="reveal-grid">{game.players.map(player => {
    const answer = game.answers[round]?.[player.id];
    return answer ? <article className="reveal-card" key={player.id}><h3>{player.name}’s contribution</h3><p>{answer.items ? answer.items.map(index => scene.actions[index].label).join(' → ') : scene.actions[answer.choice].label}</p>{answer.explanation && <blockquote>{answer.explanation}</blockquote>}</article> : null;
  })}</div>{scene.kit && <p><strong>Your three shared items:</strong> {state.kit.map(index => scene.actions[index].label).join(', ')}</p>}{state.log.find(item => item.round === round)?.event && <p>{state.log.find(item => item.round === round)?.event}</p>}<p><strong>Shared checklist:</strong> {state.definition.goal.map(flag => `${flag} ${state.flags.includes(flag) ? 'secured' : 'still open'}`).join(' · ')}</p><p>{state.resources} {scene.resource} remain for your next chapter.</p></div>;
}
export function AdventureRound({ game, myId, busy, now, onSubmit, onContinue, onReflect }: { game: ChoiceGameState; myId: string; busy: boolean; now: number; onSubmit: (answer: ChoiceAnswer) => Promise<void>; onContinue: () => Promise<void>; onReflect?: (player: string, note: GameReflection) => Promise<void> }) {
  const actor = game.mode === 'local' ? game.players[game.submitted.length]?.id ?? game.players[0].id : myId;
  const [unlocked, setUnlocked] = useState(game.mode !== 'local');
  const [choice, setChoice] = useState(-1);
  const [items, setItems] = useState<number[]>([]);
  const scene = game.deck[game.round];
  const rules = scene?.adventure;
  if (!rules) return <div className="alert error" role="alert">The adventure snapshot is missing its rules. Reconnect or start a new adventure.</div>;
  const before = adventureState(game, game.round, false);
  const state = game.phase === 'discussion' ? adventureState(game, game.round) : before;
  const player = game.players.find(p => p.id === actor);
  const turn = game.players[game.submitted.length]?.id;
  const clue = game.mode === 'online' ? game.myClues?.[game.round] : rules.clues?.[game.players.findIndex(p => p.id === actor)];
  const answer: ChoiceAnswer = { choice: rules.kit ? items[0] ?? -1 : choice, ...(rules.kit ? { items } : {}), explanation: '' };
  const remaining = Math.max(0, Math.ceil(((game.discussionUntil ?? 0) - now) / 1000));
  return <section className="adventure-round">
    <div className="round-progress"><span>CHAPTER {game.round + 1} OF {game.deck.length}</span><span>{state.resources} {rules.resource} left</span></div>
    <progress className="adventure-progress" value={game.round + (game.phase === 'discussion' ? 1 : 0)} max={game.deck.length} aria-label="Adventure progress" />
    <RelationshipArt kind={rules.world} variant={game.round} />
    <div className="scenario-card"><span className="eyebrow">{state.definition.title}</span><h2>{scene.title}</h2><p>{scene.text}</p>{rules.surprise && <p>{before.flags.includes(rules.surprise.unless) ? rules.surprise.prepared : rules.surprise.unprepared}</p>}</div>
    {game.phase === 'discussion' ? <><AdventureEvidence game={game} round={game.round} />{onReflect && <OptionalReflection game={game} myId={myId} busy={busy} onSave={onReflect} />}<QuickDiscussion game={game} myId={myId} remaining={remaining} busy={busy} onContinue={onContinue} /></>
      : !unlocked ? <div className="handoff-card"><h3>Pass the device to {player?.name}.</h3><p>Read only your own clue, then share as much as you choose. Each chapter gives you both a turn.</p><button className="button primary" onClick={() => setUnlocked(true)}>I’m {player?.name}. Show my clue</button></div>
        : <>{!clue ? <div className="alert error" role="alert">Your clue has not loaded. Reconnect before committing an action.</div> : <details className="private-clue"><summary>{player?.name}’s private briefing · choose what to share</summary><p>{clue}</p></details>}
          {game.submitted.includes(actor) ? <div className="center-card" role="status"><h3>Your action is committed.</h3><p>Waiting for your partner’s contribution. Both actions reveal together.</p></div>
            : actor !== turn ? <div className="center-card" role="status"><h3>{game.players.find(p => p.id === turn)?.name} takes this turn first.</h3><p>You can share your clue and discuss a plan. Your action unlocks after their submission.</p></div>
              : <form className="answer-form" onSubmit={event => { event.preventDefault(); void onSubmit(answer); }}>
                <fieldset><legend>{rules.kit ? 'Choose three items in priority order' : `${player?.name}, choose your contribution`}</legend><p>{rules.kit ? 'Tap in order; tap again to remove. The shared kit alternates between your lists until it has three different items.' : `Each person may spend up to ${Math.floor(state.resources / 2)} ${rules.resource} this chapter. Unused resources carry forward.`}</p><div className="adventure-actions">{rules.actions.map((action, index) => {
                  const selected = rules.kit ? items.includes(index) : choice === index;
                  const disabled = rules.kit ? !selected && items.length === 3 : action.cost > Math.floor(state.resources / 2) || !!action.requires && !state.flags.includes(action.requires);
                  return <button type="button" className={`adventure-action ${selected ? 'chosen' : ''}`} aria-pressed={selected} disabled={busy || disabled} key={action.label} onClick={() => rules.kit ? setItems(previous => selected ? previous.filter(i => i !== index) : [...previous, index]) : setChoice(index)}><AdventureObject index={index} /><span>{action.label}</span><small>{rules.kit ? selected ? `Priority ${items.indexOf(index) + 1}` : 'Add to wishlist' : `${action.cost} ${rules.resource}${action.requires && !state.flags.includes(action.requires) ? ' · needs earlier equipment' : ''}`}</small></button>;
                })}</div></fieldset><button className="button primary" disabled={busy || !clue || !validAdventureAnswer(game, answer)}>Commit my contribution</button>
              </form>}</>}
  </section>;
}
