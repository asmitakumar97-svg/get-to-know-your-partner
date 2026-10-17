import { useId, useState } from 'react';
import { ArrowRight, Check, Flower2, LockKeyhole, MessageCircle, RotateCcw, Sparkles, Users } from 'lucide-react';
import type { ChoiceAnswer, ChoiceGameState } from './game';
import { gameDefinition } from './catalog';
import { isMatchPredictionRound, optionLabels, partyRecap, partyReportText, responderIndex, comparePartyRound, validChoiceAnswer } from './party';
import { BotanicalArt } from './BotanicalArt';
import { ReportSave } from './ReportSave';
import { QuickDiscussion } from './QuickDiscussion';
import { RoundQuestion } from './RoundQuestion';
import { AnalysisPanel, ReportConversation } from './AnalysisPanel';
import { analyzeParty } from './insights';
import { isRelationshipGame, type GameReflection } from './relationshipGames';
import { AdventureRound, AdventureEvidence, AdventureEnding } from './AdventureGame';
import { OptionalReflection, SharedReflections } from './OptionalReflection';
import { RelationshipArt } from './RelationshipArt';
import { SwitchQuestion } from './SwitchQuestion';
import { OtherAnswer } from './OtherAnswer';
import { OTHER_ANSWER, responseLabel } from './writtenAnswers';

interface Props {
  game: ChoiceGameState;
  myId: string;
  busy: boolean;
  now: number;
  onSubmit: (answer: ChoiceAnswer) => Promise<void>;
  onContinue: () => Promise<void>;
  onReplay: () => Promise<void>;
  onExit: () => Promise<void>;
  onSkip?: () => Promise<void>;
  onReflect?: (player: string, note: GameReflection) => Promise<void>;
  onSwitch?: () => Promise<void>;
}

export function PartyGame(props: Props) {
  const { game, myId } = props;
  if (!game.deck.length || !game.deck[game.round]) return <div className="alert error" role="alert"><h2>No playable scenarios were restored.</h2><p>Your saved deck is empty or incomplete. Start a fresh session rather than guessing at missing answers.</p><button className="button cream" onClick={() => void props.onExit()}>End session & return to playground</button></div>;
  if (game.phase === 'recap') return <PartyReport {...props} />;
  if (game.gameType === 'us-against-the-world') return <AdventureRound key={`${game.id}:${game.round}:${game.mode === 'local' ? game.submitted.length : myId}`} {...props} />;
  const activeId = game.mode === 'local' ? game.players[game.submitted.length === 0 ? 0 : 1]?.id : myId;
  if (!activeId || !game.players.some(p => p.id === activeId)) return <div className="alert error" role="alert">Your player identity could not be restored. Refresh this room to reconnect.</div>;
  return <PartyRound key={`${game.id}:${game.round}:${game.deck[game.round].id}:${game.mode === 'local' ? game.submitted.length : myId}`} {...props} activeId={activeId} />;
}

function PartyRound({ game, myId, busy, now, onSubmit, onContinue, activeId, onSkip, onReflect, onSwitch }: Props & { activeId: string }) {
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
  const result = game.phase === 'discussion' ? comparePartyRound(game, game.round) : null;
  const waiting = game.mode !== 'local' && game.submitted.includes(myId);
  const handoff = game.mode === 'local' && !unlocked;
  const questionNote = readRoom ? `${responder.name} answers. ${game.players[1 - responderIndex(game.round)].name} predicts.` : undefined;
  const questionColor = game.gameType === 'same-brain' ? 'var(--brand-yellow)' : 'var(--brand-pink)';
  const empathy = game.gameType === 'if-i-were-you';
  const repair = game.gameType === 'when-things-get-hard';
  if (game.skippedRounds?.includes(game.round)) return <section className="discussion"><div className="center-card"><h2>A question set aside.</h2><p>Neither answer is revealed or included in your reading. No explanation is needed.</p></div><QuickDiscussion game={game} myId={myId} remaining={0} busy={busy} onContinue={onContinue} /></section>;

  return <>
    <div className="round-progress"><span>ROUND {String(game.round + 1).padStart(2, '0')} <span className="muted">OF {String(game.deck.length).padStart(2, '0')}</span></span><span>{game.gameType === 'pick-my-poison' ? ['A little tempting', 'Getting tricky', 'Delightfully ridiculous', 'Full chaos'][scenario.level] : definition.category}</span></div>
    <div className="progress-track"><div style={{ width: `${(game.round + 1) / game.deck.length * 100}%` }} /></div>
    {empathy && <RelationshipArt kind={game.gameType} variant={game.round} />}
    <RoundQuestion scenario={scenario} note={questionNote} color={questionColor} />
    {onSwitch && <SwitchQuestion game={game} busy={busy} onSwitch={onSwitch} />}
    {repair && game.phase === 'answering' && onSkip && <div className="sensitive-skip"><button className="button cream" disabled={busy} onClick={() => void onSkip()}>Skip this question for both of us</button><p>No penalty, explanation, or disclosure required. Both answers stay hidden.</p></div>}

    {game.phase === 'answering' ? waiting ? <div className="center-card"><LockKeyhole size={32} /><h2>Your answer is tucked away.</h2><p>Waiting for your partner. Actual answers and predictions reveal only after both submit.</p></div>
      : handoff ? <div className="handoff-card"><div className="round-icon"><Users /></div><h2>{game.submitted.length ? `Pass the device to ${active?.name}.` : `${active?.name}, you’re up first.`}</h2><p>{game.submitted.length ? 'The first submission is saved and hidden. Make your choice independently.' : 'No peeking. Your partner will answer after you hand over the device.'}</p>{readRoom && <p><strong>{actualRole ? 'You are the responder: choose your real answer.' : `You are predicting ${responder.name}’s response.`}</strong></p>}<button className="button primary" onClick={() => setUnlocked(true)}>I’m {active?.name}. Let’s answer <ArrowRight size={16} /></button><small>Shared-device privacy is based on trust. Answers are saved locally for refresh recovery.</small></div>
      : <form className="answer-form party-answer" onSubmit={event => { event.preventDefault(); void onSubmit(answer); }}><div className="answer-heading"><span>{active?.name}’s turn</span><span><LockKeyhole size={12} /> Hidden until you both submit</span></div>
        <ChoiceGrid name="actual-choice" title={readRoom ? actualRole ? 'What would you actually want?' : `What would ${responder.name} choose?` : game.gameType === 'more-likely' ? 'Who fits this statement better?' : empathy ? 'What I would select for me' : repair ? 'What I would naturally tend to do · not the ideal answer' : 'What I would select for me'} options={labels} selected={answer.choice} onSelect={choice => setAnswer({ ...answer, choice, customChoice: choice === OTHER_ANSWER ? answer.customChoice : undefined })} customValue={answer.customChoice} onCustomChange={customChoice => setAnswer({ ...answer, customChoice })} />
        {(game.gameType === 'pick-my-poison' || empathy) && <ChoiceGrid name="partner-prediction" title={`What I would select for ${game.players.find(p => p.id !== activeId)?.name} · my guess`} options={labels} selected={answer.prediction ?? -1} onSelect={prediction => setAnswer({ ...answer, prediction, customPrediction: prediction === OTHER_ANSWER ? answer.customPrediction : undefined })} customValue={answer.customPrediction} onCustomChange={customPrediction => setAnswer({ ...answer, customPrediction })} />}
        {isMatchPredictionRound(game) && <ChoiceGrid name="match-prediction" title="Before the reveal: do you expect your choices to match?" options={['Yes, we’ll match', 'No, we’ll choose differently']} selected={answer.matchPrediction === undefined ? -1 : answer.matchPrediction ? 0 : 1} onSelect={value => setAnswer({ ...answer, matchPrediction: value === 0 })} />}
        <label htmlFor="party-explanation" className="explanation-label">A little context <span>optional</span></label><textarea id="party-explanation" maxLength={600} value={answer.explanation} onChange={e => setAnswer({ ...answer, explanation: e.target.value })} placeholder={readRoom && !actualRole ? 'What made you predict that response?' : 'What made you choose that?'} />
        <div className="answer-submit"><span>{answer.explanation.length}/600</span><button className="button primary" disabled={busy || !validChoiceAnswer(game, answer)}>Submit answer <LockKeyhole size={15} /></button></div>
      </form>
      : game.phase === 'discussion' && result && <section className="discussion"><header className="reveal-heading"><Sparkles size={22} /><h2>{readRoom ? 'The response. And the prediction.' : 'Ready? Here’s what you chose.'}</h2><p>{readRoom ? 'Getting to know someone is a conversation, not a mind-reading test.' : 'A match is fun. A surprise is a conversation.'}</p></header><PartyEvidence game={game} round={game.round} />{game.gameType !== 'pick-my-poison' && !empathy && <div className="party-round-result"><span className="eyebrow">YOUR TWO PERSPECTIVES</span>{result.notes.map(note => <p key={note}>{note}</p>)}</div>}{onReflect && (empathy || repair && game.round % 2 === 0) && <OptionalReflection game={game} myId={myId} busy={busy} onSave={onReflect} />}<QuickDiscussion game={game} myId={myId} remaining={remaining} busy={busy} onContinue={onContinue} /></section>}
  </>;
}

function ChoiceGrid({ name, title, options, selected, onSelect, customValue = '', onCustomChange }: { name: string; title: string; options: string[]; selected: number; onSelect: (choice: number) => void; customValue?: string; onCustomChange?: (text: string) => void }) {
  return <fieldset className="choices"><legend>{title}</legend><div className="party-options">{options.map((option, i) => <label className={`choice ${selected === i ? 'chosen' : ''}`} key={i}><input type="radio" name={name} checked={selected === i} onChange={() => onSelect(i)} required /><span className="radio-mark">{selected === i && <Check size={11} />}</span><span>{option}</span></label>)}{onCustomChange && <OtherAnswer name={name} selected={selected} value={customValue} onSelect={onSelect} onChange={onCustomChange} />}</div></fieldset>;
}

function PartyEvidence({ game, round }: { game: ChoiceGameState; round: number }) {
  if (game.gameType === 'us-against-the-world') return <AdventureEvidence game={game} round={round} />;
  const result = comparePartyRound(game, round);
  if (!result) return null;
  const labels = optionLabels(game, round);
  const poison = game.gameType === 'pick-my-poison' || game.gameType === 'if-i-were-you';
  const predictor = game.players[1 - responderIndex(round)];
  const responder = game.players[responderIndex(round)];
  return <div className="party-evidence">
    <p className={`choice-comparison ${result.matched ? 'is-match' : ''}`}>{result.matched ? <Check size={18} aria-hidden="true" /> : <MessageCircle size={18} aria-hidden="true" />}<strong>{game.gameType === 'read-the-room'
      ? result.matched === null ? 'A written response · compare the prediction together.' : `${predictor.name}’s prediction ${result.matched ? 'matched' : 'didn’t match'} ${responder.name}’s response.`
      : result.matched === null ? 'Your own words · explore their meaning together.' : result.matched ? 'Your own choices matched.' : 'Your own choices were different.'}</strong></p>
    <div className="reveal-grid">{game.players.map((player, i) => {
    const answer = game.answers[round]?.[player.id];
    if (!answer) return null;
    const partner = game.players[1 - i];
    const role = game.gameType === 'read-the-room' && i !== responderIndex(round)
      ? `What ${player.name} selected for ${responder.name}`
      : `What ${player.name} selected for themselves`;
    return <article className="reveal-card" key={player.id}><h3><span className="person-circle" aria-hidden="true">{player.name.charAt(0)}</span>{player.name}</h3><dl><dt>{role}</dt><dd>{responseLabel(labels, answer.choice, answer.customChoice)}</dd>{poison && answer.prediction !== undefined && <><dt>What {player.name} selected for {partner.name}</dt><dd>{responseLabel(labels, answer.prediction, answer.customPrediction)}</dd></>}{isMatchPredictionRound(game, round) && <><dt>PREDICTED A MATCH?</dt><dd>{answer.matchPrediction ? 'Yes, we’ll match' : 'No, we’ll choose differently'}{result.matched === null && ' · not automatically assessed for written answers'}</dd></>}</dl>{answer.explanation && <blockquote>“{answer.explanation}”</blockquote>}</article>;
  })}</div>
    {poison && <section className="prediction-comparisons" aria-label="Partner prediction results"><h3>Did your predictions match?</h3><div className="prediction-grid">{game.players.map((player, i) => {
      const partner = game.players[1 - i];
      const answer = game.answers[round][player.id];
      const actual = game.answers[round][partner.id];
      if (answer.prediction === undefined) throw new Error('A saved prediction is missing.');
      const matched = result.predictionMatches[i] === true;
      return <article className="prediction-comparison" key={player.id}>
        <h4>{player.name}’s prediction for {partner.name}</h4>
        <span className={`prediction-status ${matched ? 'is-match' : ''}`}>{matched ? <Check size={16} aria-hidden="true" /> : <MessageCircle size={16} aria-hidden="true" />}{result.predictionMatches[i] === null ? 'Written answer · discuss together, without automatic matching' : matched ? `${player.name} guessed ${partner.name}’s choice` : `${partner.name} chose differently than ${player.name} expected`}</span>
        <dl><div><dt>What {player.name} selected for {partner.name}</dt><dd>{responseLabel(labels, answer.prediction, answer.customPrediction)}</dd></div><div><dt>What {partner.name} selected for themselves</dt><dd>{responseLabel(labels, actual.choice, actual.customChoice)}</dd></div></dl>
      </article>;
    })}</div></section>}
  </div>;
}

export function PartyReport({ game, busy, onReplay, onExit }: {
  game: ChoiceGameState; busy?: boolean; onReplay?: () => Promise<void>; onExit?: () => Promise<void>;
}) {
  const reportId = useId();
  const definition = gameDefinition(game.gameType);
  let result: ReturnType<typeof partyRecap>;
  try { result = partyRecap(game); }
  catch (e) { return <div className="alert error" role="alert">{e instanceof Error ? e.message : 'This report could not be generated accurately.'}</div>; }
  const isShared = game.gameType === 'same-brain' || game.gameType === 'more-likely' || game.gameType === 'when-things-get-hard';
  const cooperative = game.gameType === 'us-against-the-world';
  const surprises = result.rounds.filter(r => isShared ? r.matched === false : r.predictionMatches.includes(false));
  const written = result.rounds.some(r => r.matched === null || (['pick-my-poison', 'if-i-were-you'].includes(game.gameType) && r.predictionMatches.includes(null)));
  const analysis = analyzeParty(game, result, game.deck.map((_, round) => optionLabels(game, round)));
  return <>
    <article className="compatibility-report party-report" aria-labelledby={`${reportId}-title`}>
      <header className="report-cover">{game.gameType !== 'if-i-were-you' && (isRelationshipGame(game.gameType) ? <RelationshipArt kind={game.deck[0]?.adventure?.world ?? game.gameType} /> : <BotanicalArt className="report-bouquet" />)}<div className="eyebrow">{definition.title.toUpperCase()} · YOUR GAME REPORT</div><h2 id={`${reportId}-title`}>{cooperative ? 'A little adventure.' : 'A few surprises.'}<br />A little more <em>us.</em></h2><p className="report-names">{game.players.map(p => p.name).join(' & ')}</p><span className="report-cover-tag">Your private relationship reading</span><p>The ways you may understand each other, and the possibilities worth exploring.</p></header>
      {game.mode === 'demo' && <div className="soft-note report-demo"><Sparkles size={18} /><span><strong>This is a sample report.</strong> Your demo partner is simulated, not a real person.</span></div>}
      <div className="report-intro"><Flower2 size={23} /><div><h3>A closer look, not a score.</h3><p>These possibilities describe the choices in this game, not fixed personalities. Let each person decide what feels recognisable and what needs more context.</p></div></div>
      {cooperative && <AdventureEnding game={game} />}
      {!!game.skippedRounds?.length && <p className="soft-note">Questions you set aside are excluded from the reading and answer journal.</p>}
      <AnalysisPanel analysis={analysis} />
      <details id={`${reportId}-answers`} className="report-answer-archive"><summary>Revisit your answers & detailed breakdown</summary>
      {!cooperative && <section className="report-section">
        <header className="report-heading"><span>01</span><div><h3>The little surprises worth revisiting</h3><p>{surprises.length
          ? `${surprises.length} ${surprises.length === 1 ? 'round had' : 'rounds had'} a different choice or an unexpected answer.`
          : written ? 'Written responses are not automatically marked as matches or differences. Revisit them in your journal.' : isShared ? 'Your selected choices matched in every completed round. Your reasons can still differ.' : 'Your predictions matched the actual responses in every completed round. The reasons can still surprise you.'}</p></div></header>
        {surprises.length ? <div className="party-surprises">{surprises.map(round => <a href={`#${reportId}-journal-${round.round}`} key={round.round} onClick={event => {
          event.preventDefault();
          const panel = document.getElementById(`${reportId}-journal-${round.round}`);
          if (panel instanceof HTMLDetailsElement) {
            panel.open = true;
            panel.scrollIntoView({ block: 'start' });
            panel.querySelector('summary')?.focus({ preventScroll: true });
          }
        }}><MessageCircle size={17} /><span>{game.deck[round.round].title}</span><ArrowRight size={15} /></a>)}</div>
          : <div className="soft-note">{written ? 'Try asking “What would you like me to understand about the words you chose?” Different wording alone does not establish a different preference.' : isShared
            ? 'Try asking “Did we choose that for the same reason?” A match is the start of a conversation, not proof that you know everything about each other.'
            : 'Try asking “What helped you predict my choice, and when might I choose differently?” An accurate prediction is an invitation to understand the context, not a reason to stop asking.'}</div>}
      </section>}
      <section className="report-section"><header className="report-heading"><span>02</span><div><h3>Your conversation journal</h3><p>Exact choices, responses, predictions, and voluntarily shared reflections — never a judgment about the person.</p></div></header><div className="journal report-journal">{result.rounds.map(round => <details id={`${reportId}-journal-${round.round}`} key={round.round}><summary>{round.round + 1}. {game.deck[round.round].title}</summary><p>{game.deck[round.round].text}</p><PartyEvidence game={game} round={round.round} /><SharedReflections game={game} round={round.round} /><div className="party-round-result">{round.notes.map(note => <p key={note}>{note}</p>)}</div><p className="journal-prompt">{round.prompt}</p></details>)}</div></section>
      <ReportSave getText={() => partyReportText(game, 'archive')} filename={`${game.gameType}-private-answer-journal.txt`} variant="journal" />
      </details>
      <ReportConversation analysis={analysis} answersId={`${reportId}-answers`} />
      <ReportSave getText={() => partyReportText(game)} filename={`${game.gameType}-private-report.txt`} />
    </article>
    {onReplay && onExit && <div className="recap-actions"><button className="button primary" disabled={busy} onClick={() => void onReplay()}><RotateCcw size={16} /> Play again{game.mode === 'online' ? ' in a new room' : ''}</button><button className="button cream" disabled={busy} onClick={() => void onExit()}>Choose another game</button></div>}
  </>;
}
