import { useId, useMemo } from 'react';
import { BookHeart, Check, Flower2, Heart, MessageCircle, Sparkles } from 'lucide-react';
import { emotions, scenarioFactors, scenarioVerdicts, type GameState } from './game';
import { buildReflection, reflectionText, type ReportRound } from './report';
import { BotanicalArt } from './BotanicalArt';
import { ReportSave } from './ReportSave';
import { AnalysisPanel, ReportConversation } from './AnalysisPanel';
import { analyzeSamePage } from './insights';
import { responseLabel } from './writtenAnswers';

const threadLabels = [
  ['verdict', 'How you see it', 'Verdict alignment'],
  ['emotion', 'How it feels', 'Emotional alignment'],
  ['values', 'What matters', 'Values alignment'],
] as const;

export function CompatibilityReport({ game }: { game: GameState }) {
  const answersId = useId();
  const result = useMemo(() => {
    try { return { report: buildReflection(game), error: '' }; }
    catch (error) { return { report: null, error: error instanceof Error ? error.message : 'Your report could not be generated.' }; }
  }, [game]);
  const report = result.report;
  if (!report) return <div role="alert" className="alert error">{result.error}</div>;
  const analysis = analyzeSamePage(report);

  return <article className="compatibility-report" aria-labelledby="report-title">
    <header className="report-cover">
      <BotanicalArt className="report-bouquet" />
      <div className="eyebrow">YOUR CONNECTION, IN CONVERSATION</div>
      <h2 id="report-title">A little more you.<br />A little more <em>us.</em></h2>
      <p className="report-names">{report.players.map(p => p.name).join(' & ')}</p>
      <span className="report-cover-tag">Your private relationship reading</span>
      <p>A closer look at what may sit beneath the choices you made together.</p>
    </header>

    {report.isDemo && <div className="soft-note report-demo"><Sparkles size={18} /><span><strong>This is a sample report.</strong> Alex is simulated. These observations do not describe a real couple.</span></div>}
    <div className="report-intro"><BookHeart size={23} /><div><h3>A reflection, not a verdict.</h3><p>These possibilities come from your recorded choices. Only you can say whether they fit your life; neither perspective is a flaw.</p></div></div>

    <AnalysisPanel analysis={analysis} />
    <details id={answersId} className="report-answer-archive"><summary>Revisit your answers & detailed breakdown</summary>
    <section className="report-section" aria-labelledby="threads-title">
      <ReportHeading number="01" title="The three threads of your connection" id="threads-title" subtitle="Each tells a different story. We keep them separate." />
      <div className="report-threads">{threadLabels.map(([key, title, label]) => <div key={key}><span className="thread-decoration" aria-hidden="true">{key === 'verdict' ? '✦' : key === 'emotion' ? '♡' : '✿'}</span><h4>{title}</h4><span>{label}</span><small>{key === 'verdict' ? 'How each of you interprets a situation.' : key === 'emotion' ? 'How it feels to each of you, independently of the verdict.' : 'Which concern matters most, without assuming identical values.'}</small></div>)}</div>
    </section>

    <div className="report-perspectives">
      <section className="report-section shared-section" aria-labelledby="shared-title">
        <ReportHeading number="02" title="Where you met" id="shared-title" subtitle="Shared choices, with the situations behind them." />
        {report.sharedGround.length ? report.sharedGround.map(round => <details className="insight-card" key={round.index}><summary><Check size={15} /><span>{round.scenario.title}<small>{round.shared.length} shared {round.shared.length === 1 ? 'choice' : 'choices'} · {round.scenario.category}</small></span></summary><p>{round.scenario.text}</p><ul>{round.shared.map(item => <li key={item}>{item}</li>)}</ul><p className="insight-prompt">Try asking: “Do we mean the same thing by that answer?”</p></details>) : <p className="report-empty">No exact shared choices in these scenarios. That is not a verdict on your connection. Start by understanding what each choice meant to you.</p>}
      </section>
      <section className="report-section explore-section" aria-labelledby="explore-title">
        <ReportHeading number="03" title="Where there’s more to discover" id="explore-title" subtitle="Not a list of problems. Invitations to get curious." />
        {report.differentPerspectives.length ? report.differentPerspectives.map(round => <details className="insight-card" key={round.index}><summary><MessageCircle size={15} /><span>{round.scenario.title}<small>{round.differences.length} different {round.differences.length === 1 ? 'choice' : 'choices'} · {round.scenario.category}</small></span></summary><RoundEvidence round={round} names={report.players.map(p => p.name)} /><p className="insight-prompt">{round.prompt}</p></details>) : <p className="report-empty">{report.structured ? 'No automatic differences were found among comparable choices. Written answers are not marked as matches or differences; explore them together in your journal.' : 'You selected the same choices in every completed scenario. Your reasons and real-life expectations may still differ. Compare what those choices mean to each of you.'}</p>}
      </section>
    </div>

    {report.sameTakeDifferentFeeling.length > 0 && <aside className="report-spotlight"><Heart size={24} /><div><h3>Same take. Different feelings.</h3><p>In {report.sameTakeDifferentFeeling.length} {report.sameTakeDifferentFeeling.length === 1 ? 'scenario' : 'scenarios'}, you selected the same verdict but different emotions: {report.sameTakeDifferentFeeling.map(r => r.scenario.title).join('; ')}. Agreeing on an interpretation doesn’t mean an experience feels the same. Ask what care would feel supportive for each of you.</p></div></aside>}

    <section className="report-section" aria-labelledby="themes-title">
      <ReportHeading number="04" title="Your connection, theme by theme" id="themes-title" subtitle="Only the scenarios you both answered count. No assumptions about unplayed themes." />
      <div className="theme-grid">{report.themes.map(theme => <article className={`theme-card ${theme.rounds.length ? '' : 'theme-unplayed'}`} key={theme.category}><div className="theme-card-top"><Flower2 size={19} /><h4>{theme.category}</h4></div>{theme.rounds.length ? <><p>{theme.rounds.length} {theme.rounds.length === 1 ? 'scenario' : 'scenarios'} explored{theme.rounds.length === 1 ? ' · one example, not a trend' : ''}</p><details><summary>See the situations</summary><ul>{theme.rounds.map(round => <li key={round.index}>{round.scenario.title}</li>)}</ul></details></> : <p>Not explored in this session.<br />No conclusion to draw yet.</p>}</article>)}</div>
    </section>

    <section className="report-section" aria-labelledby="care-title">
      <ReportHeading number="05" title="A little guide to understanding each other" id="care-title" subtitle="Your selected feelings and priorities — not a personality profile. Ask what fits; don’t assume." />
      <div className="care-grid">{report.players.map(player => <article className="care-card" key={player.id}><header><span aria-hidden="true">♡</span><h4>{player.name}’s perspective</h4></header><div className="care-body"><h5>Feelings you selected</h5><ul className="frequency-list">{player.feelings.map(item => <li key={item.label}><span>{item.label}</span><strong>{item.count} {item.count === 1 ? 'time' : 'times'}</strong></li>)}</ul><h5>What you prioritized</h5><ul className="frequency-list">{player.priorities.map(item => <li key={item.label}><span>{item.label}</span><strong>{item.count} {item.count === 1 ? 'time' : 'times'}</strong></li>)}</ul><details className="care-prompts"><summary>Explore what support could look like</summary><ul>{player.carePrompts.map(prompt => <li key={prompt}>{prompt}</li>)}</ul></details></div></article>)}</div>
    </section>

    <section className="report-section" aria-labelledby="journal-title">
      <ReportHeading number="06" title="Your conversation journal" id="journal-title" subtitle="Every situation, your exact choices, and your own words. Open a card to revisit it together." />
      <div className="journal report-journal">{report.rounds.map(round => <details key={round.index}><summary>{round.index + 1}. {round.scenario.title}<span>{round.scenario.category}</span></summary><RoundEvidence round={round} names={report.players.map(p => p.name)} /><p className="journal-prompt">{round.prompt}</p></details>)}</div>
    </section>

    <ReportSave getText={() => reflectionText(report, 'archive')} filename="same-page-private-answer-journal.txt" variant="journal" />
    </details>
    <ReportConversation analysis={analysis} answersId={answersId} />

    <ReportSave getText={() => reflectionText(report)} />
  </article>;
}

function ReportHeading({ number, title, subtitle, id }: { number: string; title: string; subtitle: string; id: string }) {
  return <header className="report-heading"><span aria-hidden="true">{number}</span><div><h3 id={id}>{title}</h3><p>{subtitle}</p></div></header>;
}

function RoundEvidence({ round, names }: { round: ReportRound; names: string[] }) {
  return <div className="report-evidence"><p>{round.scenario.text}</p>{round.answers.map((answer, i) => <div className="journal-answer" key={i}><strong>{names[i]}</strong><dl><div><dt>Verdict</dt><dd>{responseLabel(scenarioVerdicts(round.scenario), answer.verdict, answer.customVerdict)}</dd></div><div><dt>Feeling</dt><dd>{responseLabel(emotions, answer.emotion, answer.customEmotion)}</dd></div><div><dt>Main reason</dt><dd>{responseLabel(scenarioFactors(round.scenario), answer.factor, answer.customFactor)}</dd></div></dl>{answer.explanation && <blockquote>“{answer.explanation}”</blockquote>}</div>)}</div>;
}
