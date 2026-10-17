import { ArrowRight, Clock3 } from 'lucide-react';

export function DiscussionContinue({ online, remaining, busy, waiting, onContinue }: {
  online: boolean; remaining: number; busy: boolean; waiting: boolean; onContinue: () => Promise<void>;
}) {
  return <>
    <div className="discussion-bottom">
      <span><Clock3 size={16} /> {remaining > 0 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} suggested discussion time` : 'Keep talking for as long as you like'}</span>
      <button className="button primary" onClick={() => void onContinue()} disabled={busy || waiting}>
        {waiting ? 'Waiting for your partner…' : remaining > 0 ? online ? 'Skip timer · I’m ready' : 'Skip timer · continue' : online ? 'I’m ready to continue' : 'We’re ready to continue'}<ArrowRight size={15} />
      </button>
    </div>
    <small>{online ? 'Skip or chat. Continue only when both are ready.' : 'Skip or chat. Take as much time as you like.'}</small>
  </>;
}
