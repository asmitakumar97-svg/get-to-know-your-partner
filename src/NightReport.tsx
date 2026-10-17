import { ArrowRight, Check, Flower2, Heart, RotateCcw } from 'lucide-react';
import { gameDefinition } from './catalog';
import { isChoiceGame, type SessionState } from './game';
import { nightReflection, nightReportText } from './night';
import { CompatibilityReport } from './CompatibilityReport';
import { PartyReport } from './PartyGame';
import { ReportSave } from './ReportSave';
import { BotanicalArt } from './BotanicalArt';

function GameReport({ game }: { game: SessionState }) {
  return isChoiceGame(game) ? <PartyReport game={game} /> : <CompatibilityReport game={game} />;
}

export function NightArchive({ game }: { game: SessionState }) {
  const completed = game.night?.completed;
  if (!completed?.length) return null;
  return <section className="report-section"><header className="report-heading"><div><h3>Your complete game reports</h3><p>Every answer, explanation, and conversation prompt, kept in its original game.</p></div></header>
    {completed.map((saved, i) => <details className="night-game-report" key={i}><summary>{i + 1}. {gameDefinition(saved.gameType ?? 'same-page').title} · full report</summary><GameReport game={saved} /></details>)}
  </section>;
}

export function NightProgress({ game }: { game: SessionState }) {
  const night = game.night;
  if (!night) return null;
  return <nav className="night-progress" aria-label="Your game-night playlist"><span>YOUR GAME NIGHT</span><ol>{night.playlist.map((entry, i) =>
    <li key={entry.gameType} aria-current={!night.finished && i === night.index ? 'step' : undefined}>
      <span aria-hidden="true">{i < night.completed.length ? <Check size={13} /> : i + 1}</span>{gameDefinition(entry.gameType).title}
    </li>)}</ol></nav>;
}

export function NightRecap({ game, myId, busy, onNext, onReplay, onExit }: {
  game: SessionState; myId: string; busy: boolean;
  onNext: () => Promise<void>; onReplay: () => Promise<void>; onExit: () => Promise<void>;
}) {
  const night = game.night;
  if (!night) return <div className="alert error" role="alert">This session has no game-night playlist.</div>;
  if (night.finished) return <CombinedReport game={game} busy={busy} onReplay={onReplay} onExit={onExit} />;
  const finalGame = night.index === night.playlist.length - 1;
  const waiting = game.mode === 'online' && game.ready.includes(myId);
  const departed = game.players.some(p => p.left);
  return <section className="night-intermission">
    <div className="round-icon"><Flower2 /></div>
    <div className="eyebrow">GAME {night.index + 1} OF {night.playlist.length} COMPLETE</div>
    <h2>{departed ? 'A pause in your game night.' : finalGame ? 'A whole little night of us.' : 'One game. A little more to know.'}</h2>
    <p>{departed ? 'The playlist cannot continue after a departure. Your completed game reports are still available below.' : finalGame ? 'Your combined relationship reflection is ready when you both are.' : `Up next: ${gameDefinition(night.playlist[night.index + 1].gameType).title}. Take a breather, then continue together.`}</p>
    <p>{departed ? 'The completed answers stay with this game night. You can still open the reports below.' : 'Your answers are saved for one combined report after the last game. No separate reports to stop for along the way.'}</p>
    {!departed && <button className="button primary" disabled={busy || waiting} onClick={() => void onNext()}>
      {waiting ? 'Waiting for your partner…' : finalGame ? 'See our game-night report' : 'Play the next game'}<ArrowRight size={16} />
    </button>}
    {game.mode === 'online' && !departed && <small>Both players must be ready. Your room and invite stay the same.</small>}
    {departed && <><details className="night-game-report"><summary>View our {gameDefinition(game.gameType ?? 'same-page').title} report</summary><GameReport game={game} /></details><NightArchive game={game} /></>}
  </section>;
}

function CombinedReport({ game, busy, onReplay, onExit }: {
  game: SessionState; busy: boolean; onReplay: () => Promise<void>; onExit: () => Promise<void>;
}) {
  let report: ReturnType<typeof nightReflection>;
  try { report = nightReflection(game); }
  catch (error) { return <div className="alert error" role="alert">{error instanceof Error ? error.message : 'Your combined report could not be generated.'}</div>; }
  return <article className="night-report">
    <header className="report-cover"><BotanicalArt className="report-bouquet" /><div className="eyebrow">YOUR TWO-PERSON PLAYGROUND · THE WHOLE NIGHT</div><h2>Many little games.<br />One more chapter of <em>us.</em></h2><p className="report-names">{game.players.map(p => p.name).join(' & ')}</p><span className="report-cover-tag">{report.summaries.length} games · {report.total} rounds explored</span></header>
    {game.mode === 'demo' && <div className="soft-note">Sample game night: one partner is simulated, not a real person.</div>}
    <div className="report-intro"><Heart size={23} /><div><h3>Your relationship, in conversation. Not a grade.</h3><p>A reflection on what you actually chose, predicted, and felt tonight. Shared choices, emotional perspectives, and playful points stay separate. They cannot diagnose your relationship or predict its future.</p></div></div>
    <section className="report-section"><header className="report-heading"><Flower2 /><div><h3>Five ways to discover. Your own little story.</h3><p>Only the games you played appear below. No combined compatibility percentage.</p></div></header>
      <div className="night-summary-grid">{report.summaries.map(item => <section className="night-summary-card" key={item.title}><h4>{item.title}</h4><p>{item.total} completed rounds</p><ul>{item.lines.map(line => <li key={line}>{line}</li>)}</ul>
        <h5>Shared ground & accurate predictions</h5>{item.shared.length ? <p>{item.shared[0]}</p> : <p>No exact shared choice or fully accurate prediction in these rounds. That is not a measure of your connection.</p>}
        <h5>A little more to discover</h5>{item.discoveries.length ? <p>{item.discoveries[0]}</p> : <p>No unexpected selected answers this time. Your reasons and the context can still be different.</p>}
        <h5>Keep this conversation going</h5><p>{item.prompts[0]}</p>
      </section>)}</div>
    </section>
    <section className="report-next"><h3>One thing to take into tomorrow.</h3><p>Each share one thing you learned about your person. Ask what small gesture, conversation, or shared plan would feel good next. Let them tell you, rather than treating a game answer as a fixed rule.</p></section>
    <NightArchive game={game} />
    <ReportSave getText={() => nightReportText(game)} filename="our-private-game-night-report.txt" />
    <div className="recap-actions"><button className="button primary" disabled={busy} onClick={() => void onReplay()}><RotateCcw size={16} /> Play this playlist again</button><button className="button cream" disabled={busy} onClick={() => void onExit()}>Back to playground</button></div>
  </article>;
}
