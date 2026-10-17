import { ArrowRight, Clock3 } from 'lucide-react';

export function DiscussionContinue({ online, remaining, busy, waiting, onContinue }: {
  online: boolean; remaining: number; busy: boolean; waiting: boolean; onContinue: () => Promise<void>;
}) {
  return <>
    <div className="discussion-bottom">
      <span><Clock3 size={16} /> {remaining > 0 ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} ${online ? 'suggested discussion time' : 'to pause & talk'}` : 'Keep talking for as long as you like'}</span>
      <button className="button primary" onClick={() => void onContinue()} disabled={(!online && remaining > 0) || busy || waiting}>
        {waiting ? 'Waiting for your partner…' : online ? remaining > 0 ? 'Skip timer · I’m ready' : 'I’m ready to continue' : 'We’re ready to continue'}<ArrowRight size={15} />
      </button>
    </div>
    <small>{online ? 'Discussion is optional. You can both mark ready now to skip the timer, or keep talking as long as you like. The next round starts only when both are ready.' : 'The timer is a minimum pause, not a deadline. Continue only when you both feel heard.'}</small>
  </>;
}
