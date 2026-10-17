import { useId } from 'react';
import { BookHeart } from 'lucide-react';
import { insightSupport, selectReportInsights, type InsightEvidence, type RelationshipAnalysis } from './insights';

function Evidence({ examples, observation }: { examples: InsightEvidence[]; observation?: string }) {
  return examples.length > 0 && <details className="analysis-evidence"><summary>Evidence behind this reading</summary>{observation && <p>{observation}</p>}<ul>{examples.map((example, i) => <li key={i}><strong>{example.title}</strong>{example.question && <p>{example.question}</p>}<p>{example.detail}</p></li>)}</ul></details>;
}

export function AnalysisPanel({ analysis }: { analysis: RelationshipAnalysis }) {
  const id = useId();
  const insights = selectReportInsights(analysis);
  return <section className="relationship-analysis" aria-labelledby={`${id}-title`}>
    <header className="report-heading"><BookHeart size={25} /><div><h3 id={`${id}-title`}>Your relationship, between the lines</h3><p>Possible readings of your choices, not conclusions about who you are.</p></div></header>
    <div className="analysis-insights story-insights">{insights.map((insight, i) => <article key={insight.title}><span className="story-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><h4>{insight.title}</h4><small className="story-support">{insightSupport(insight) === 'repeated' ? 'Seen across different situations' : 'A small observation, not a recurring pattern'}</small><p className="story-pattern">{insight.pattern}</p><p>{insight.meaning}</p><p className="story-implication"><strong>In practice: </strong>{insight.nextStep}</p><Evidence examples={insight.evidence} observation={insight.observation} /></article>)}</div>
    {!insights.length && <p>There are not enough paired answers to offer an interpretation yet. A smaller set of answers is not a reason to invent a deeper story.</p>}
    <details className="analysis-evidence report-method"><summary>About this reading</summary><p>{analysis.scope}</p><p>Observed choices support each insight. Possible meanings and practical suggestions are hypotheses to explore together, not evidence of motives, emotional needs, or real-life habits.</p></details>
  </section>;
}

export function ReportConversation({ analysis, answersId }: { analysis: RelationshipAnalysis; answersId: string }) {
  return <section className="report-next report-conversation"><div className="eyebrow">ONE CONVERSATION TO TAKE OFF-SCREEN</div><h3>Something worth discovering together</h3>{analysis.conversation ? <p className="conversation-question">{analysis.conversation.question}</p> : <p>There are not enough paired answers to choose a conversation based on this game yet.</p>}<a className="button cream" href={`#${answersId}`} onClick={event => {
    event.preventDefault();
    const answers = document.getElementById(answersId);
    if (answers instanceof HTMLDetailsElement) {
      answers.open = true;
      answers.scrollIntoView({ block: 'start' });
      answers.querySelector('summary')?.focus({ preventScroll: true });
    }
  }}>Revisit your answers</a></section>;
}
