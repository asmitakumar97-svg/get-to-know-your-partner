import type { InsightEvidence, RelationshipAnalysis, RelationshipInsight } from './insights';

export function includeWrittenPerspectives(analysis: RelationshipAnalysis, evidence: InsightEvidence[], total: number, structuredCount: number, title: string): RelationshipAnalysis {
  const insight: RelationshipInsight = {
    title: 'Your own words leave something worth asking',
    pattern: `In ${title}, at least one response was written rather than selected from the preset options.`,
    observation: 'Written responses are preserved as submitted. Neither similar wording nor different wording is automatically treated as agreement or disagreement.',
    meaning: 'These words give you something specific to ask about, but do not establish a recurring need, a motive, or a communication style. Even a response that sounds familiar may carry a different meaning for each person. Let its author explain what matters before deciding whether your perspectives overlap.',
    nextStep: 'Each choose a phrase from a written response and ask its author what they most want understood about it.',
    evidence: evidence.slice(0, 3),
  };
  const conversation = {
    context: `From ${title}: ${evidence[0].title}. A written response needs its author's interpretation, not an automatic label.`,
    question: 'What would you like me to understand about your own words here, and what should I ask before assuming we mean the same thing?',
    evidence: evidence.slice(0, 1),
  };
  return {
    ...analysis,
    ...(!structuredCount ? {
      headline: 'Your own words, without a preset label',
      summary: 'You have paired answers to explore together. Written responses are not automatically categorised, matched, or interpreted as relationship traits.',
      conversation,
    } : {}),
    scope: `Based on ${total} paired situations. Automated patterns use only fully predefined responses; written responses stay in the journal and are not interpreted for traits or match results. ${analysis.context === 'repair' ? 'Skipped questions and private reflections remain excluded.' : 'This is a conversation starting point, not a compatibility assessment.'}`,
    alignmentNote: structuredCount ? `${analysis.alignmentNote} Written responses are not automatically compared.` : 'Paired written responses are available, but are not automatically compared.',
    insights: [...(structuredCount ? analysis.insights : []), insight],
  };
}
