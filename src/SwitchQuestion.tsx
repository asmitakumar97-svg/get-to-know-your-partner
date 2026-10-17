import { Shuffle } from 'lucide-react';
import type { SessionState } from './game';
import { canSwitchQuestion, replacementQuestions } from './questionSwitching';

export function SwitchQuestion({ game, busy, onSwitch }: {
  game: SessionState; busy: boolean; onSwitch: () => Promise<void>;
}) {
  if (!canSwitchQuestion(game)) return null;
  const available = replacementQuestions(game).length > 0;
  return <div className="question-switch">
    <button type="button" className="text-button" disabled={busy || !available} onClick={() => void onSwitch()}><Shuffle size={16} /> Switch question</button>
    <small>{available ? 'A different question for both of you. Clears unsent selections; available before either answer is submitted.' : 'No unused alternatives remain for this selection.'}</small>
  </div>;
}
