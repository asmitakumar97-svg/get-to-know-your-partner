import { useId, useState } from 'react';
import { ArrowRight, Check, Flower2, LockKeyhole, MessageCircle, RotateCcw, Sparkles, Users } from 'lucide-react';
import type { ChoiceAnswer, ChoiceGameState } from './game';
import { gameDefinition } from './catalog';
import { isBonusRound, optionLabels, partyRecap, partyReportText, responderIndex, scorePartyRound, validChoiceAnswer } from './party';
import { BotanicalArt, FloralSticker } from './BotanicalArt';
import { ReportSave } from './ReportSave';
import { DiscussionContinue } from './DiscussionContinue';

interface Props {
  game: ChoiceGameState;
  myId: string;
  busy: boolean;
  now: number;
  onSubmit: (answer: ChoiceAnswer) => Promise<void>;
  onContinue: () => Promise<void>;
  onReplay: () => Promise<void>;
  onExit: () => Promise<void>;
}

export function PartyGame(props: Props) {
  const { game, myId } = props;
  if (game.phase === 'recap') return <PartyReport {...props} />;
  const activeId = game.mode === 'local' ? game.players[game.submitted.length === 0 ? 0 : 1]?.id : myId;
  if (!activeId || !game.players.some(p => p.id === activeId)) return <div className="alert error" role="alert">Your player identity could not be restored. Refresh this room to reconnect.</div>;
  return <PartyRound key={`${game.id}:${game.round}:${game.mode === 'local' ? game.submitted.length : myId}`} {...props} activeId={activeId} />;
}

function PartyRound({ game, myId, busy, now, onSubmit, onContinue, activeId }: Props & { activeId: string }) {
  const [answer, setAnswer] = useState<ChoiceAnswer>({ choice: -1, explanation: '' });
  const [unlocked, setUnlocked] = useState(false);
  const active = game.players.find(p => p.id === activeId);
  const definition = gameDefinition(game.gameType);
  const scenario = game.deck[game.round];
  const labels = optionLabels(game);
  const responder = game.players[responderIndex(game.round)];
  const actualRole = activeId === responder.id;
  const readRoom = game.gameType === 'read-the-room';
  const remaining = Math.max(0, Math.ceil(((game.discussionUntil ?? 0) - now) / 1000));
  const result = game.phase === 'discussion' ? scorePartyRound(game, game.round) : null;
  const waiting = game.mode !== 'local' && game.submitted.includes(myId);
  const handoff = game.mode === 'local' && !unlocked;

  return <>
    <div className="round-progress"><span>ROUND {String(game.round + 1).padStart(2, '0')} <span className="muted">OF {String(game.deck.length).padStart(2, '0')}</span></span><span>{isBonusRound(game) ? 'BONUS · PREDICT THE MATCH' : game.gameType === 'pick-my-poison' ? ['A little tempting', 'Getting tricky', 'Delightfully ridiculous', 'Full chaos'][scenario.level] : definition.category}</span></div>
    <div className="progress-track"><div style={{ width: `${(game.round + 1) / game.deck.length * 100}%` }} /></div>
    <div className="scenario-card"><FloralSticker className="scenario-sticker" color={game.gameType === 'same-brain' ? '#b1afe8' : game.gameType === 'pick-my-poison' ? '#efa763' : '#eaa1be'} /><div className="eyebrow">{scenario.title}</div><h2>{scenario.text}</h2><span className="muted">{readRoom ? `${responder.name} answers honestly. ${game.players[1 - responderIndex(game.round)].name} predicts.` : 'Answer independently. Reveal together. Stay curious.'}</span></div>
    <details className="party-rules"><summary>How this game works</summary><p>{definition.rules}</p><p>{definition.scoring}</p></details>

    {game.phase === 'answering' ? waiting ? <div className="center-card"><LockKeyhole size={32} /><h2>Your answer is tucked away.</h2><p>Waiting for your partner. Actual answers and predictions reveal only after both submit.</p></div>
      : handoff ? <div className="handoff-card"><div className="round-icon"><Users /></div><h2>{game.submitted.length ? `Pass the device to ${active?.name}.` : `${active?.name}, you’re up first.`}</h2><p>{game.submitted.length ? 'The first submission is saved and hidden. Make your choice independently.' : 'No peeking. Your partner will answer after you hand over the device.'}</p>{readRoom && <p><strong>{actualRole ? 'You are the responder: choose your real answer.' : `You are predicting ${responder.name}’s response.`}</strong></p>}<button className="button primary" onClick={() => setUnlocked(true)}>I’m {active?.name}. Let’s answer <ArrowRight size={16} /></button><small>Shared-device privacy is based on trust. Answers are saved locally for refresh recovery.</small></div>
      : <form className="answer-form party-answer" onSubmit={event => { event.preventDefault(); void onSubmit(answer); }}><div className="answer-heading"><span>{active?.name}’s turn</span><span><LockKeyhole size={12} /> Hidden until you both submit</span></div>
        <ChoiceGrid name="actual-choice" title={readRoom ? actualRole ? 'What would you actually want?' : `What would ${responder.name} choose?` : game.gameType === 'more-likely' ? 'Who fits this statement better?' : 'Your own honest choice'} options={labels} selected={answer.choice} onSelect={choice => setAnswer({ ...answer, choice })} />
        {game.gameType === 'pick-my-poison' && <ChoiceGrid name="partner-prediction" title={`Now predict ${game.players.find(p => p.id !== activeId)?.name}’s choice`} options={labels} selected={answer.prediction ?? -1} onSelect={prediction => setAnswer({ ...answer, prediction })} />}
        {isBonusRound(game) && <ChoiceGrid name="match-prediction" title="Bonus: will your actual choices match?" options={['Yes, we’ll match', 'No, we’ll choose differently']} selected={answer.matchPrediction === undefined ? -1 : answer.matchPrediction ? 0 : 1} onSelect={value => setAnswer({ ...answer, matchPrediction: value === 0 })} />}
        <label htmlFor="party-explanation" className="explanation-label">A little context <span>optional</span></label><textarea id="party-explanation" maxLength={600} value={answer.explanation} onChange={e => setAnswer({ ...answer, explanation: e.target.value })} placeholder={readRoom && !actualRole ? 'What made you predict that response?' : 'What made you choose that?'} />
        <div className="answer-submit"><span>{answer.explanation.length}/600 · No perfect answer needed.</span><button className="button primary" disabled={busy || !validChoiceAnswer(game, answer)}>Tuck my answer away <LockKeyhole size={15} /></button></div>
      </form>
      : game.phase === 'discussion' && result && <section className="discussion"><header className="reveal-heading"><Sparkles size={22} /><h2>{readRoom ? 'The response. And the prediction.' : 'Ready? Here’s what you chose.'}</h2><p>{readRoom ? 'Getting to know someone is a conversation, not a mind-reading test.' : 'A match is fun. A surprise is a conversation.'}</p></header><PartyEvidence game={game} round={game.round} /><div className="party-round-result"><span className="eyebrow">THIS ROUND, JUST FOR PLAY</span>{result.notes.map(note => <p key={note}>{note}</p>)}</div><div className="discussion-prompt"><div className="eyebrow"><MessageCircle size={15} /> MAKE ROOM FOR THE CONVERSATION</div><h3>{result.prompt}</h3><p>Try “What made you choose that?” or “Is that always true, or does it depend?” Listen with curiosity.</p><DiscussionContinue online={game.mode === 'online'} remaining={remaining} busy={busy} waiting={game.ready.includes(myId)} onContinue={onContinue} /></div></section>}
  </>;
}

function ChoiceGrid({ name, title, options, selected, onSelect }: { name: string; title: string; options: string[]; selected: number; onSelect: (choice: number) => void }) {
  return <fieldset className="choices"><legend>{title}</legend><p>Pick the closest fit. Context can be part of the conversation.</p><div className="party-options">{options.map((option, i) => <label className={`choice ${selected === i ? 'chosen' : ''}`} key={i}><input type="radio" name={name} checked={selected === i} onChange={() => onSelect(i)} required /><span className="radio-mark">{selected === i && <Check size={11} />}</span><span>{option}</span></label>)}</div></fieldset>;
}

function PartyEvidence({ game, round }: { game: ChoiceGameState; round: number }) {
  const labels = optionLabels(game, round);
  return <div className="reveal-grid">{game.players.map((player, i) => {
    const answer = game.answers[round]?.[player.id];
    if (!answer) return null;
    const role = game.gameType === 'read-the-room' ? i === responderIndex(round) ? 'ACTUAL RESPONSE' : 'THEIR PREDICTION' : 'ACTUAL CHOICE';
    return <article className="reveal-card" key={player.id}><h3><span className="person-circle" aria-hidden="true">{player.name.charAt(0)}</span>{player.name}</h3><dl><dt>{role}</dt><dd>{labels[answer.choice]}</dd>{game.gameType === 'pick-my-poison' && answer.prediction !== undefined && <><dt>PREDICTED PARTNER’S CHOICE</dt><dd>{labels[answer.prediction]}</dd></>}{isBonusRound(game, round) && <><dt>PREDICTED A MATCH?</dt><dd>{answer.matchPrediction ? 'Yes, we’ll match' : 'No, we’ll choose differently'}</dd></>}</dl>{answer.explanation && <blockquote>“{answer.explanation}”</blockquote>}</article>;
  })}</div>;
}

export function PartyReport({ game, busy, onReplay, onExit }: {
  game: ChoiceGameState; busy?: boolean; onReplay?: () => Promise<void>; onExit?: () => Promise<void>;
}) {
  const reportId = useId();
  const definition = gameDefinition(game.gameType);
  let result: ReturnType<typeof partyRecap>;
  try { result = partyRecap(game); }
  catch (e) { return <div className="alert error" role="alert">{e instanceof Error ? e.message : 'This report could not be generated accurately.'}</div>; }
  const isShared = game.gameType === 'same-brain' || game.gameType === 'more-likely';
  const surprises = result.rounds.filter(r => isShared ? !r.matched : r.playerPoints.some((points, i) => r.attempts[i] && points === 0));
  return <>
    <article className="compatibility-report party-report" aria-labelledby={`${reportId}-title`}>
      <header className="report-cover"><BotanicalArt className="report-bouquet" /><div className="eyebrow">{definition.title.toUpperCase()} · YOUR GAME REPORT</div><h2 id={`${reportId}-title`}>A few surprises.<br />A little more <em>us.</em></h2><p className="report-names">{game.players.map(p => p.name).join(' & ')}</p><span className="report-cover-tag">{result.total} of {game.deck.length} rounds explored</span><p>What you chose, what you predicted, and the conversations to take with you.</p></header>
      {game.mode === 'demo' && <div className="soft-note report-demo"><Sparkles size={18} /><span><strong>This is a sample report.</strong> Your demo partner is simulated, not a real person.</span></div>}
      <div className="report-intro"><Flower2 size={23} /><div><h3>Little game points. Not a relationship grade.</h3><p>{definition.scoring}</p><p>Your answers describe these situations, not fixed traits or your overall compatibility. Different preferences, feelings, and perceptions do not make anyone wrong.</p></div></div>
      <section className="report-section"><header className="report-heading"><span>01</span><div><h3>Your game, in a nutshell</h3><p>Shared matches and individual predictions stay separate.</p></div></header><div className="party-score-grid">{isShared && <article><Flower2 size={27} /><h4>Your shared points</h4><strong>{result.sharedPoints} <small>of {result.total}</small></strong><p>{game.gameType === 'more-likely' ? 'Rounds where you chose the same named person.' : 'Rounds where your actual choices matched.'}</p></article>}{result.players.filter(p => p.attempts > 0).map(player => <article key={player.id}><Sparkles size={25} /><h4>{player.name}</h4><strong>{player.points} <small>of {player.attempts}</small></strong><p>{game.gameType === 'same-brain' ? 'Final-round match-prediction bonus points.' : `Accurate predictions from ${player.attempts} ${player.attempts === 1 ? 'opportunity' : 'opportunities'}.`}</p></article>)}</div>{game.gameType === 'read-the-room' && <p className="party-scope-note">Roles alternated. With an odd number of rounds, one player has one extra prediction opportunity. Compare what you learned, not raw totals.</p>}</section>
      <section className="report-section">
        <header className="report-heading"><span>02</span><div><h3>The little surprises worth revisiting</h3><p>{surprises.length
          ? `${surprises.length} ${surprises.length === 1 ? 'round had' : 'rounds had'} a different choice or an unexpected answer.`
          : isShared ? 'Your selected choices matched in every completed round. Your reasons can still differ.' : 'Your predictions matched the actual responses in every completed round. The reasons can still surprise you.'}</p></div></header>
        {surprises.length ? <div className="party-surprises">{surprises.map(round => <a href={`#${reportId}-journal-${round.round}`} key={round.round} onClick={event => {
          event.preventDefault();
          const panel = document.getElementById(`${reportId}-journal-${round.round}`);
          if (panel instanceof HTMLDetailsElement) {
            panel.open = true;
            panel.scrollIntoView({ block: 'start' });
            panel.querySelector('summary')?.focus({ preventScroll: true });
          }
        }}><MessageCircle size={17} /><span>{game.deck[round.round].title}</span><ArrowRight size={15} /></a>)}</div>
          : <div className="soft-note">{isShared
            ? 'Try asking “Did we choose that for the same reason?” A match is the start of a conversation, not proof that you know everything about each other.'
            : 'Try asking “What helped you predict my choice, and when might I choose differently?” An accurate prediction is an invitation to understand the context, not a reason to stop asking.'}</div>}
      </section>
      <section className="report-section"><header className="report-heading"><span>03</span><div><h3>Your conversation journal</h3><p>Exact choices, actual responses, and predictions — never a judgment about the person.</p></div></header><div className="journal report-journal">{result.rounds.map(round => <details id={`${reportId}-journal-${round.round}`} key={round.round}><summary>{round.round + 1}. {game.deck[round.round].title}</summary><p>{game.deck[round.round].text}</p><PartyEvidence game={game} round={round.round} /><div className="party-round-result">{round.notes.map(note => <p key={note}>{note}</p>)}</div><p className="journal-prompt">{round.prompt}</p></details>)}</div></section>
      <section className="report-next"><BotanicalArt className="next-botanical" variant="sprig" /><div className="eyebrow">YOUR NEXT LITTLE CONVERSATION</div><h3>Less assuming.<br />More asking.</h3><ol><li>Share one answer that surprised or delighted you.</li><li>Ask what context could change that choice.</li><li>Choose one small thing you would enjoy trying together.</li></ol><p>You don’t need to match on everything to understand each other better.</p></section>
      <ReportSave getText={() => partyReportText(game)} filename={`${game.gameType}-private-report.txt`} />
    </article>
    {onReplay && onExit && <div className="recap-actions"><button className="button primary" disabled={busy} onClick={() => void onReplay()}><RotateCcw size={16} /> Play again{game.mode === 'online' ? ' in a new room' : ''}</button><button className="button cream" disabled={busy} onClick={() => void onExit()}>Choose another game</button></div>}
  </>;
}
